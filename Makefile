NAME=EucaLobo
VER=$(shell awk -F= '{if($$1=="Version"){gsub(/[\"\",;]+/,"",$$2);print $$2;}}' $(NAME)/application.ini)
OSX=$(NAME).app/Contents
build_dir = build

all:

run: dev
	$(OSX)/MacOS/xulrunner -jsconsole

dev:	clean_osx
	ln -sf `pwd`/$(NAME)/chrome $(OSX)/Resources/chrome 
	ln -sf `pwd`/$(NAME)/defaults $(OSX)/Resources/defaults 
	ln -sf `pwd`/$(NAME)/application.ini $(OSX)/Resources/application.ini
	ln -sf `pwd`/$(NAME)/chrome.manifest $(OSX)/Resources/chrome.manifest

build:	clean build_osx build_win build_linux xpi md5
	make dev

md5:
<<<<<<< HEAD
	(cd ../ && for f in *.zip *.xpi; do md5 $$f > $$f.md5;done)
=======
	for f in $(build_dir)/{*.zip,*.xpi}; do md5sum $$f > $$f.md5;done
>>>>>>> b6e7d217cb606aa98bffd73292711d87dfffa814

prepare: clean prepare_osx

prepare_osx: clean_osx
	cp -a $(NAME)/application.ini $(NAME)/chrome $(NAME)/chrome.manifest $(NAME)/defaults $(OSX)/Resources

build_osx: prepare_osx
	zip -rqy $(build_dir)/$(NAME)-osx-$(VER).zip $(NAME).app -x '**/.DS_Store'

build_win:
	zip -rq $(build_dir)/$(NAME)-win-$(VER).zip $(NAME) -x '**/.DS_Store'

build_linux:
	zip -rq $(build_dir)/$(NAME)-linux-$(VER).zip $(NAME) -x '*/xulrunner/**' '*.exe' '*.dll' '**/.DS_Store'
	
xpi:
	sed -i '' 's/pref("toolkit.defaultChromeURI"/\/\/pref("toolkit.defaultChromeURI"/' $(NAME)/defaults/preferences/prefs.js
	(cd $(NAME) && zip -rq ../$(build_dir)/$(NAME)-$(VER).xpi . -x 'xulrunner/**' 'xulrunner/' 'ElasticWolf*' '*.ini' '**.DS_Store')
	sed -i '' 's/\/\/pref("toolkit.defaultChromeURI"/pref("toolkit.defaultChromeURI"/' $(NAME)/defaults/preferences/prefs.js

clean: clean_osx
	rm -rf *.zip *.xpi $(build_dir)
	mkdir -p $(build_dir)

clean_osx:
	rm -rf $(OSX)/Resources/chrome $(OSX)/Resources/application.ini $(OSX)/Resources/defaults $(OSX)/Resources/chrome.manifest

put:	build
	./s3upload www.elasticwolf.com/Releases/ElasticWolf-osx-$(VER).zip $(build_dir)/ElasticWolf-osx-$(VER).zip 
	./s3upload www.elasticwolf.com/Releases/ElasticWolf-osx-$(VER).zip.md5 $(build_dir)/ElasticWolf-osx-$(VER).zip.md5
	./s3upload www.elasticwolf.com/Releases/ElasticWolf-win-$(VER).zip $(build_dir)/ElasticWolf-win-$(VER).zip 
	./s3upload www.elasticwolf.com/Releases/ElasticWolf-win-$(VER).zip.md5 $(build_dir)/ElasticWolf-win-$(VER).zip.md5
	./s3upload www.elasticwolf.com/Releases/ElasticWolf-linux-$(VER).zip $(build_dir)/ElasticWolf-linux-$(VER).zip 
	./s3upload www.elasticwolf.com/Releases/ElasticWolf-linux-$(VER).zip.md5 $(build_dir)/ElasticWolf-linux-$(VER).zip.md5
	./s3upload www.elasticwolf.com/Releases/ElasticWolf-$(VER).xpi $(build_dir)/ElasticWolf-$(VER).xpi
	./s3upload www.elasticwolf.com/Releases/ElasticWolf-$(VER).xpi.md5 $(build_dir)/ElasticWolf-$(VER).xpi.md5
	./s3upload www.elasticwolf.com/index.html $(VER)

.PHONY: clean_osx dev
