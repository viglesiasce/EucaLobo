# ElasticWolf

ElasticWolf is an application for managing Amazon Web Services resources with a simple and
easy to use client-side UI.

This project started as a fork of ElasticFox but most of the code has been rewritten since then. 
It adds support for the GovCloud region, much better VPC support, and many other enhancements. 
It is also packaged with all necessary tools and utilities to deal with private and public 
keys and SSL certificates. In short, it provides everything for an AWS user to get going 
without using the command line tools.

In addition, it integrates well with the AWS command line tools such that the user can
easily configure both ElasticWolf and the CLI to work together.

The project has been supported by the Global Public Sector sales team of AWS to provide a
better customer experience when using the new GovCloud (ITAR-compliant) AWS region.
GovCloud is not currently supported by the AWS Console.  However, it is designed to work
with all regions, so please file bugs if you find problems in any region.

The Windows version of the tool is packaged with openssl for generating keys and ssh
clients for accessing Linux instances.

## Testing On Mac OS X

   *  Retrieve source code from the repository

       git clone git://github.com/aws-ew-dev/ElasticWolf.git

   * Primary development is done on Mac so there is a special dev mode to run it as
     an OS X application with symlinks to the actual source code

       make run

   * To get updates just execute inside the source directory

      git pull

## Testing on On Windows

   * Download Git for Windows from http://code.google.com/p/msysgit/downloads/list 
     or
     Explorer integration of Git from http://code.google.com/p/gitextensions/

   * Use Git UI to manage repository or

     * Launch cmd.exe and cd to the directory where you want to keep the source code

     * Retrieve source code from the repository

        "C:\Program Files\Git\cmd\git" clone git://github.com/aws-ew-dev/ElasticWolf.git

   * To run the application execute with javascript console 

       ElasticWolf/ElasticWolf.exe -jsconsole

       or

       just execute ElasticWolf.exe from the Windows Explorer without debug console

   * To get updates just execute inside the source directory

      "C:\Program Files\Git\cmd\git" pull

   * To access git command line utilities without full path, go to 
     My computer | Properties | Advanced System Properties | Environment Variables and 
     add path to the git C:\Program Files\Git\cmd to Path system variable. 

## Building releases

 To create binary packages for Mac and Windows, just type

  make build

 it will produce two .zip files for each platform

## Download binary releases

  Packages for Windows and  Mac OS X are available at http://www.awsps.com/ElasticWolf

## Passing credentials via command line

 The parameters are:

 * -key AWS Access key id
 * -secret - AWS Access Secret
 * -endpoint - URL for the endpoint
 * -name Name for passed credentials
 * -lock - lock the credentials and not allow to change it

## Developers:
  Vlad Seryakov

## QA and support:
 * Mark Ryland
 * Ben Butler
 * Tim Wilson
 * Chris Gorski
 * Nathan McCourtney
