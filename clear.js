var fs = require('fs');
var url = require('url');
var path = require('path');

var file = 'BackendTasks.sqlite';

try {
    fs.openSync(file, 'r');
} catch (err) {
    console.error('No database found.  Cannot continue.  Missing filename: ' + file);
    process.exit()
}

var sqlite3 = require('sqlite3').verbose();
var db = new sqlite3.Database(file);

// /data.json supports following parameters:
//    rows: number of total rows to fetch from incomplete and completed tasks
//    lists: 0/1 in indicate whether lists should be fetched
//    limitResults: number of rows per list to include in final output (only applies if rows is not set and lists is 1)
// if lists are included (they are by default) and there isn't a limit on number of rows,
// the tasks will be returned in sorted order, sorted by list and then within list.  incomplete tasks precede completed tasks.
// additionally, lists will be returned in sorted order.
// If lists are included and there isn't a limit on number of rows,
// a sorted index value is assigned to each task and each list.
var http = require('http');
http.createServer(function(req, res) {
    console.log('Serving request for: ' + req.url);
    var parsedUrl = url.parse(req.url, true);

    if (parsedUrl.pathname == '/data.json') {
        console.log(parsedUrl.query);
        var limitQuery = '';
        if ('rows' in parsedUrl.query) {
            limitQuery = ' limit ' + parsedUrl.query.rows;
        }
        var includeLists = true;
        if ('lists' in parsedUrl.query && parsedUrl.query.lists == '0') {
            includeLists = false;
        }
        var limitResults = -1;
        if ('limitResults' in parsedUrl.query) {
            if (limitQuery != '' || includeLists == false) {
                throw ('limitResults only applies if rows is not set and lists are included.');
            }
            limitResults = parsedUrl.query.limitResults;
        }

        // include incomplete and completed tasks
        db.all("\
        select t.list_identifier as list, t.title as task, r.fire_time, '0' as completed, t.prev_identifier as prev, t.next_identifier as next, t.identifier from \
            tasks t \
            left outer join task_reminders r on r.task_identifier = t.identifier" + limitQuery, function(err, rows) {
            if (err) throw err;
            db.all("select c.list_identifier as list, c.title as task, r.fire_time, '1' as completed, c.prev_identifier as prev, c.next_identifier as next, c.identifier from \
                completed_tasks c \
                left outer join task_reminders r on r.task_identifier = c.identifier" + limitQuery, function(err, completedRows) {
                if (err) throw err;
                var joinedRows = rows.concat(completedRows);

                if (includeLists) {
                    db.all("select identifier, title, prev_identifier as prev from lists", function(err, listTitles) {
                        if (err) throw err;
                        var listItems = listTitles;
                        // if there is not a limit to the query and lists are included, sort based on previous and next
                        if (limitQuery == '') {
                            var sortedLists = new Array();

                            // create a dictionary mapping an object's prev_identifier to itself
                            var previousIdentifierToObject = new Object();
                            // find the starting element, which does not have a prev_identifier
                            var previousElementToFind = null;
                            for (var i = 0; i < listTitles.length; ++i) {
                                if (listTitles[i].prev != null) {
                                    previousIdentifierToObject[listTitles[i].prev] = listTitles[i];
                                } else {
                                    // found starting point
                                    previousElementToFind = listTitles[i];
                                }
                            }

                            // build sorted list
                            while (previousElementToFind != null) {
                                // add item to sorted list
                                sortedLists.push(previousElementToFind);
                                // using dictionary of object's prev_identifier to itself,
                                // get the object that has the current identifier (previousElementToFind.identifier) as prev_identifier.
                                // that object will be added to list next
                                previousElementToFind = previousIdentifierToObject[previousElementToFind.identifier];
                                // if there is no item that has current identifier as prev_identifier, we have reached the end
                            }

                            // sort items by list and then within list.  incomplete tasks are before completed tasks.

                            // build dictionary of list identifier to tuple of [identifier of first incomplete task, and identifier of first complete task]
                            var listToFirstTasks = new Object();
                            // build dictionary of task identifier to task
                            var taskIdentifierToTask = new Object();
                            // iterate over list items, populating dictionary
                            console.log('Total number of rows: ' + joinedRows.length);
                            for (var i = 0; i < joinedRows.length; ++i) {
                                var task = joinedRows[i];
                                // add task to dictionary based on identifier
                                taskIdentifierToTask[task.identifier] = task;

                                // if task is the first item in a list, incomplete or complete
                                if (task.prev == null) {
                                    var tuple = listToFirstTasks[task.list];
                                    if (tuple == null) {
                                        tuple = [,];
                                    }
                                    // tuple is [first incomplete task, first complete task]
                                    var tupleIndex = 0;
                                    if (task.completed == '1') {
                                        tupleIndex = 1;
                                    }
                                    tuple[tupleIndex] = task.identifier;
                                    listToFirstTasks[task.list] = tuple;
                                }
                            }

                            var countOfSortedTasks = 0;
                            var sortedTasks = new Array();
                            console.log('Sorted Lists:')
                            // iterate over sorted lists, putting all tasks associated with that list into the sorted list of tasks
                            for (var i = 0; i < sortedLists.length; ++i) {
                                sortedLists[i].numIncomplete = 0;
                                sortedLists[i].numComplete = 0;
                                sortedLists[i].index = i;

                                var listIdentifier = sortedLists[i].identifier;
                                console.log('   ' + sortedLists[i].title + ',     id: '+ listIdentifier);
                                var firstTaskIdentifiers = listToFirstTasks[listIdentifier];
                                for (tupleIndex in firstTaskIdentifiers) {
                                    var numberOfTasksInList = 0;
                                    // get first incomplete/complete task for list and then iterate to add sorted tasks to list
                                    var taskIdentifier = listToFirstTasks[listIdentifier][tupleIndex];
                                    // while there is a task identifier
                                    while (taskIdentifier) {
                                        // add associated task to list
                                        var task = taskIdentifierToTask[taskIdentifier];
                                        if (!task) {
                                            // there is no reason this should occur, but better to handle it, just in case
                                            throw ('No task for identifier: ' + taskIdentifier);
                                        }
                                        // add counter as index of task
                                        task['index'] = countOfSortedTasks;

                                        sortedTasks.push(task);
                                        // set next task identifier as task identifier
                                        taskIdentifier = task.next;

                                        ++countOfSortedTasks;
                                        ++numberOfTasksInList;

                                        // If limiting the results, remove the task after adding it to the list.
                                        // This is a bit of an odd approach, but it allows for complete counts of tasks in lists
                                        // as well as a limit to the results.
                                        if (limitResults > 0 && numberOfTasksInList > limitResults) {
                                            sortedTasks.pop();
                                        }
                                    }

                                    if (tupleIndex == 0) {
                                        sortedLists[i].numIncomplete = numberOfTasksInList;
                                    } else {
                                        sortedLists[i].numComplete = numberOfTasksInList;
                                    }
                                }
                                console.log('      Incomplete tasks:\t' + sortedLists[i].numIncomplete +
                                            '.  Complete tasks:\t' + sortedLists[i].numComplete +
                                            '.  Total so far:\t' + countOfSortedTasks);
                            }

                            // we will return sorted lists and tasks
                            listItems = sortedLists;
                            joinedRows = sortedTasks;
                        }

                        var data = {'tasks' : joinedRows, 'lists' : listItems};
                        res.writeHead(200, {'Content-Type': 'text/json'});
                        res.write(JSON.stringify(data));
                        res.end();
                    });
                } else {
                    res.writeHead(200, {'Content-Type': 'text/json'});
                    res.write(JSON.stringify(joinedRows));
                    res.end();
                }
            });
        });
    } else if (req.url == '/') {
        var filename = 'clear.html';
        fs.readFile(filename, 'binary', function(err, file) {
            res.writeHead(200);
            res.write(file, 'binary');
            res.end();
        });
    } else {
        var uri = url.parse(req.url).pathname;
        var filename = path.join(process.cwd(), uri);

        fs.readFile(filename, 'binary', function(err, file) {
            if (err) {
                res.writeHead(404, {'Content-Type': 'text/plain'});
                res.write('File not found: ' + uri);
                res.end();
                return;
            }
            var ext = path.extname(filename);
            if (ext == '.js') {
                res.writeHead(200, {'Content-Type': 'application/javascript'});
            } else if (ext == '.css') {
                res.writeHead(200, {'Content-Type': 'text/css'});
            } else {
                res.writeHead(200);
            }
            res.write(file, 'binary');
            res.end();
        });
    }
}).listen('8080', '127.0.0.1');
