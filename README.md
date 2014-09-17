## clearvis

This simple web app allows you to visualize data from [Clear](http://realmacsoftware.com/clear), a to-do and reminders app from [Realmac Software](http://realmacsoftware.com/).

It offers read-only access to your data based on a local backup of your Clear database.

It supports filtering by list, searching in task or reminder field, and sorting by original order
(order of tasks in the app) as well as by task title, reminder date, or completion status.

**Getting Started:**
1. Copy your Clear database into repository directory
    - Copy file `99d3f5add8496de5e444d54418d57afb1080a8ff` from your mobile backup directory (in `~/Library/Application Support/MobileSync/Backup/[device_id]/` on Mac OS X)
        - Note that `SHA-1('AppDomain-com.realmacsoftware.clear-Library/Application Support/com.realmacsoftware.clear/BackendTasks.sqlite') = 99d3f5add8496de5e444d54418d57afb1080a8ff`
        - Reference on backups can be found at the [The iPhone Wiki](http://theiphonewiki.com/wiki/ITunes_Backup)
    - Alternatively, use [iExplorer](http://www.macroplant.com/iexplorer/) from [Macroplant](http://www.macroplant.com/) to copy the BackendTasks.sqlite file from the `com.realmacsoftware.clear` bundle
    - Please note that `clear.js` uses the default filename of BackendTasks.sqlite.  If you rename your database file to something like `clear.sqlite`, you must change the filename in `clear.js` as well.
    - Lastly, the above assumes you are using Clear for iOS.  If you are using Clear for Mac, you can find the database file named LocalTasks.sqlite in `~/Library/Containers/com.realmacsoftware.clear.mac/Data/Library/Application Support/com.realmacsoftware.clear.mac/`.  You will need to rename the file or change the filename in `clear.js`.
2. Download and install [Node.js](http://nodejs.org/)
    - Use [npm](https://www.npmjs.org/) to download and install the [sqlite3](https://www.npmjs.org/package/sqlite3) module as well
3. Run `node clear` from from the repository directory in Terminal
4. Open web browser and visit http://localhost:8080/

**Toggles:**
- *Completed Tasks* - ternary toggle to show mix of incomplete and complete tasks, only complete tasks, or only incomplete tasks
- *Index Column* - toggle to display index of tasks
- *Task Counts* - toggle display of incomplete/complete task counts next to list titles
- *Statistics* - toggle display of statistics table, which shows incomplete and complete task counts for each list

**Obfuscation:**
- Useful if you are viewing your data in public - hovering over the obfuscated data displays the cleartext
- To enable, do not return 'input' at the beginning of the `obfuscate` method in `clear.html`

**Data:**
- You can access your Clear database's raw data - task and list information - by visiting http://localhost:8080/data.json

**data.json parameters:**
- The following parameters are supported
    - rows: number of total rows to fetch from incomplete and completed tasks
    - lists: 0/1 to indicate whether lists should be fetched; 1 by default
    - limitResults: number of rows per list to include in final output (only applies if rows is not set and lists is 1)
- Example: `data.json?lists=1&limitResults=5` will return an array of tasks, with a maximum of five tasks
per incomplete and complete list, along with an array of lists
- Also, if lists are included (lists=1) and there isn't a limit on number of rows (rows isn't set),
a sorted index value is assigned to each task and each list

**Notes:**
- Emoji &#x1F430; does not render correctly in Chrome; try Safari or another browser instead
- The search controls are designed to float along the left of the page.  To disable this, comment out the *Positioning and layout* section of the `<style>` block in `clear.html`

**Technologies Used:**
- [Node.js](http://nodejs.org/)
    - With [sqlite3](https://www.npmjs.org/package/sqlite3) module
- [DataTables](http://www.datatables.net/)

**How it Works:**
- `clear.js` uses Node.js to create a simple local server to serve a web page - `clear.html`
- `clear.html` creates a table and initializes DataTables to make an Ajax request for data.json
- When data.json is received, the lists are iterated over and relevant data - title, counts of incomplete and complete tasks, index, etc - about each list is stored for future access
    - Each list is given a unique color, starting with colors based on [Bootstrap](http://getbootstrap.com/)'s callouts
- The table is populated with the tasks from data.json and each row is given the same color as its list
- Once the table is initialized, the list data is used to create a toggle for each list and to populate the statistics table

###### *Many thanks to [Realmac Software](http://realmacsoftware.com/) for creating [Clear](http://realmacsoftware.com/clear)!*
