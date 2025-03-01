Deployed version : https://metacell.github.io/sds-viewer/
- [User Manual - Loading Datasets](https://github.com/MetaCell/sds-viewer/tree/development#sds-viewer-user-manual)
- [User Manual - Navigating the Components](https://github.com/MetaCell/sds-viewer/tree/development#navigating-the-sds-viewer)
- [Running Application Locally](https://github.com/MetaCell/sds-viewer/tree/development#sds-viewer-running-instructions)

## SDS Viewer User Manual 

Users can load datasets in a few different ways. 

1) Loading a SPARC Dataset:
   - Click on 'SPARC Datasets' button, it's located on the lower left corner.
   - On the window that opens up, select the dataset you want to load. 
   ![image](https://user-images.githubusercontent.com/4562825/166984322-83b4a8c2-aa29-4e6d-96e9-bcf4d125a3a9.png)
   - After selection, click 'Done'
   - Dataset will be loaded.
   - Datasets list comes from https://cassava.ucsd.edu/sparc/datasets/

2) Loading an external dataset with a URL :
   - Click on 'Import a new dataset'
   - On the window that opens up, select 'From a URL'
   - Paste the dataset url onto the textfield. For this use case, we only need to enter the URL of the turtle file.
     URL example https://cassava.ucsd.edu/sparc/preview/archive/exports/2021-06-21T103507%2C091927-0700/datasets/N%3Adataset%3A02d6f93c-56cd-471b-bbb9-99f65f47d203.ttl
     ![image](https://user-images.githubusercontent.com/4562825/136597116-4098f4eb-34ce-4abd-92fa-c6fbf6f2c92e.png)
   - Click 'Load' and then 'Done'
   - Dataset will be loaded

3) Loading an local dataset:
   - Click on 'Import a new dataset'
   - On the window that opens up, stay on 'Local System'.
   - Add turtle and json file at the same time. 
     ![image](https://user-images.githubusercontent.com/4562825/136603905-83145d22-0bff-47b2-ae09-7117acc4c246.png)
   - Click 'Done'
   - Dataset will be loaded

4) Loading a dataset specifying ID as parameter
   - Users can specify the id of the dataset as a parameter on the URL and load it this way.
   - For example, if user wants to load Dataset with ID 013224e7-e3e3-4d8a-90ef-d1b237323eff, we can add the id as parameter : 
     https://metacell.github.io/sds-viewer/?id=013224e7-e3e3-4d8a-90ef-d1b237323eff
     This will open up the SDS Viewer with the dataset already loaded.

### Navigating the SDS Viewer
   - Users can search for subjects, folders and files on the sidebar. Selecting an item on the sidebar will display the Metadata for it and zoom the Graph to its corresponding node. 

![image](https://user-images.githubusercontent.com/4562825/186722724-45df437a-4105-468a-8df9-e63f4d979163.png)

   - Selecting an item on the Graph will display its Metadata. 

![image](https://user-images.githubusercontent.com/4562825/186723085-c6573146-82dc-4fb7-ae95-588f7b1e4842.png)

   - Navigating the Graph Viewer can be done with the mouse. There's also controlers on the bottom right that allows the user to change the Layout view, zoom in/out, and reset the view to its original state.
![image](https://user-images.githubusercontent.com/4562825/186723372-2529d10e-e257-4834-b19e-7ec47ec306e5.png)

   - Multiple Datasets can be loaded at the same time, which will open a new Graph Viewer Component for each dataset.

![image](https://user-images.githubusercontent.com/4562825/186723829-201ebc46-6bf2-4b7a-9d03-bf97fe0a37c5.png)


### Datasets Used
The datasets we have been testing can be found here https://cassava.ucsd.edu/sparc/preview/archive/exports/2021-06-21T103507%2C091927-0700/

### Error Handling
- In the case of encountering an error, take a screenshot and report it with us please by opening an [issue](https://github.com/MetaCell/sds-viewer/issues/new)
- To go back , click on the 'x' to go back to the previous screen.


## SDS Viewer Running Instructions

1. Install node.js https://nodejs.org/en/
2. Open a terminal.
   - Mac
      - On your Mac, do one of the following:
         - Click the Launchpad icon  in the Dock <img src="https://help.apple.com/assets/5FDD15EE12A93C067904695E/5FDD15F412A93C0679046966/en_US/a1f94c9ca0de21571b88a8bf9aef36b8.png" alt="" height="15" width="15" originalimagename="SharedGlobalArt/AppIconTopic_Launchpad.png"> , type Terminal in the search field, then click Terminal.
         - In the Finder <img src="https://help.apple.com/assets/5FDD15EE12A93C067904695E/5FDD15F412A93C0679046966/en_US/058e4af8e726290f491044219d2eee73.png" alt="" height="15" width="15" originalimagename="SharedGlobalArt/AppIconTopic_Finder.png">, open the /Applications/Utilities folder, then double-click Terminal.
   -  Windows
      - Follow steps in [this link](https://www.howtogeek.com/194041/how-to-open-the-command-prompt-as-administrator-in-windows-8.1/) to open a terminal as administrator in your Windows machine. 
   - Linux
      -  Open a terminal
3. Install yarn:
   - Mac 
      - In the OS X terminal you need to type:
         `sudo npm install --global yarn`
          - NOTE: You'll be ask to enter your local system password.
      - If previous step fails, you can also install it with brew.  
         `brew install yarn`
   - Windows
      - In a Windows terminal, type command:
         `npm install --global yarn`
   
4. Install git
   - Mac
      - In a terminal, install git by typing : 
         `brew install git`  or `sudo yarn add git` 
   - Windows
      - Download installer from https://git-scm.com/download/win and run it.
   - Linux
      - Install it with 
         `sudo apt-get install git`
5. In terminal, type command `git clone -b feature/demo https://github.com/MetaCell/sds-viewer.git`
   - Output should be something like this.
   ![image](https://user-images.githubusercontent.com/4562825/136595047-0255afff-3b52-4cbe-9e2b-575ec4e46a66.png)

6. Then navigate to the sds-viewer folder with command `cd sds-viewer`
7. Then type `sudo yarn install --ignore-engines`
8. Finally, to run application type `sudo yarn start`
9. Last step should have opened a new browser tab with 'http://localhost:3000/', it will take a 1 minute before it finishes loading the first time.
   This should be the browser output.
   ![image](https://user-images.githubusercontent.com/4562825/166983757-c4ea69ba-5d9a-4792-881a-89113cb5b1b6.png)
