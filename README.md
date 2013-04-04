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

   * To download the ElasticWolf project from the GitHub repository:

     git clone git://github.com/aws-ew-dev/ElasticWolf.git

   * Primary development is done on Mac so there is a special dev mode to run it as
     an OS X application with symlinks to the actual source code:

     make run

   * To get updates, execute the following in the source directory:

     git pull

## Testing On Windows

   * Download a Git client for Windows.  A number of Git clients are available:

     * http://git-scm.com/downloads/guis
     * http://windows.github.com/
     * http://code.google.com/p/msysgit/downloads/list
     * http://code.google.com/p/gitextensions/ (Explorer integration)
     * https://code.google.com/p/tortoisegit/ (Explorer integration)

   * To download the ElasticWolf project from the GitHub repository:

     * Use your Git UI, or
     * Launch cmd.exe, cd to the directory where you want to keep the source code, and
       run git clone git://github.com/aws-ew-dev/ElasticWolf.git

   * To run the ElasticWolf application:

     * ElasticWolf/ElasticWolf.exe -jsconsole (runs with a javascript debug console)
     * Simply execute ElasticWolf.exe from Windows Explorer

   * To get ElasticWolf updates:

     * Use your Git UI and pull from the repository, or
     * Run git pull in the source directory

## Testing on Linux

   * To retrieve source code from the repository:

     git clone git://github.com/aws-ew-dev/ElasticWolf.git

   * To install xulrunner (for example on Ubuntu):

     apt-get install xulrunner

   * Execute ElasticWolf/ElasticWolf

   * If xulrunner is not available as a package, use the commands below to install it:

     * cd /opt
     * sudo wget -O- https://ftp.mozilla.org/pub/mozilla.org/xulrunner/releases/13.0/runtimes/xulrunner-13.0.en-US.linux-`uname -p`.tar.bz2 | tar -xj
     * sudo ln -s /opt/xulrunner/xulrunner /usr/bin/xulrunner

## Building Releases

 Releases must be built on a Mac and cannot be built on Windows.  To create binary packages
 for both Mac and Windows, just type: make build.  This will produce .zip files for each platform.

## Download Binary Releases

  Packages for Windows, Linux and Mac OS X are available at http://www.elasticwolf.com

## Passing credentials on the command line

 The parameters are:

 * -key: AWS access key
 * -secret: AWS secret access key
 * -endpoint: URL for the endpoint
 * -token: security token
 * -name: name for the passed credentials
 * -lock: lock the credentials and do not allow user to change them
 * -jsconsole: load the javascript debug console

## Developers:
  Vlad Seryakov

## QA and Support:
 * Mark Ryland
 * Ben Butler
 * Tim Wilson
 * Chris Gorski
 * Nathan McCourtney
