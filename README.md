A google drive type of thing to be able to make your home device work like cloud storage built off a ts and React workflow.
<img width="1600" height="760" alt="image" src="https://github.com/user-attachments/assets/27d53603-9f51-4808-9829-f503f45a011b" />
This project is a fork of [MyDrive](https://github.com/subnub/myDrive/) that I've been editing to make work without a MongoDB database (since I'm unable to host one locally on my rpi,) and as such, all the download/setup instructions are basically the same, except that I also added a field for FS_TRASH in the .env files. Currently I've yet to repair most of the applications functions, but here's the list of things that I did get working:
1. Pulling files and folders directly off of my file system
2. Setting thumbnails directly from the files on the file system
3. Navigating the file system through the application (and then recursively adding the thumbnails in the route)
4. Uploading files

This is the list of things displayed in the project that I've still yet to get working again:
1. Uploading and creating folders
2. moving files
3. trashing and deleting files
4. Renaming files
5. downloading files
6. Settings (once I install a new account system into there as well...)
