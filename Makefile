NAME=ElasticWolf
VER=$(shell awk '{if($$1=="VERSION:"){gsub(/[\"\",;]+/,"",$$2);print $$2;}}' $(NAME)/chrome/content/core.js)
OSX=$(NAME).app/Contents

all:

run: dev
	$(OSX)/MacOS/xulrunner -jsconsole

dev:	clean_osx
	ln -sf `pwd`/$(NAME)/chrome $(OSX)/Resources/chrome 
	ln -sf `pwd`/$(NAME)/defaults $(OSX)/Resources/defaults 
	ln -sf `pwd`/$(NAME)/application.ini $(OSX)/Resources/application.ini
	ln -sf `pwd`/$(NAME)/chrome.manifest $(OSX)/Resources/chrome.manifest

build:	clean build_osx build_win build_linux xpi
	make dev

prepare: clean prepare_osx

prepare_osx: clean_osx
	cp -a $(NAME)/application.ini $(NAME)/chrome $(NAME)/chrome.manifest $(NAME)/defaults $(OSX)/Resources

build_osx: prepare_osx
	zip -rqy ../$(NAME)-osx-$(VER).zip $(NAME).app

build_win:
	zip -rq ../$(NAME)-win-$(VER).zip $(NAME)

build_linux:
	zip -rq ../$(NAME)-linux-$(VER).zip $(NAME) -x '*/xulrunner/**' '*.exe' '*.dll'
	
xpi:
	(cd $(NAME) && zip -rq ../../$(NAME)-$(VER).xpi . -x 'xulrunner/**')

clean: clean_osx
	rm -rf *.zip *.xpi ../$(NAME)-*.zip ../*.xpi

clean_osx:
	rm -rf $(OSX)/Resources/chrome $(OSX)/Resources/application.ini $(OSX)/Resources/defaults $(OSX)/Resources/chrome.manifest

put:	build
	./s3upload www.elasticwolf.com/Releases/ElasticWolf-osx-$(VER).zip ../ElasticWolf-osx-$(VER).zip 
	./s3upload www.elasticwolf.com/Releases/ElasticWolf-win-$(VER).zip ../ElasticWolf-win-$(VER).zip 
	./s3upload www.elasticwolf.com/Releases/ElasticWolf-linux-$(VER).zip ../ElasticWolf-linux-$(VER).zip 
	[ -f ../ElasticWolf-$(VER).xpi ] && ./s3upload www.elasticwolf.com/Releases/ElasticWolf-$(VER).xpi ../ElasticWolf-$(VER).xpi
	./s3upload www.elasticwolf.com/index.html $(VER)

.PHONY: clean_osx dev
