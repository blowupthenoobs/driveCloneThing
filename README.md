This project is a fork of [MyDrive](https://github.com/subnub/myDrive/) that I've been editing to make work without a MongoDB database (since I'm unable to host one locally on my rpi,) and as such, all the download/setup instructions are basically the same, except that I also added a field for FS_TRASH in the .env files. Currently I've yet to repair most of the applications functions, but here's the list of things that I did get working:
1. Pulling files and folders directly off of my file system
2. Setting thumbnails directly from the files on the file system
3. Navigating the file system through the application (and then recursively adding the thumbnails in the route)
4. Uploading files
