NAME=ElasticWolf
VER=$(shell awk '{if($$1=="VERSION:"){gsub(/[\"\",;]+/,"",$$2);print $$2;}}' $(NAME)/chrome/content/core.js)
OSX=$(NAME).app/Contents

all:

run: dev
	$(OSX)/MacOS/xulrunner -jsconsole

dev:	clean
	ln -sf `pwd`/$(NAME)/chrome $(OSX)/Resources/chrome 
	ln -sf `pwd`/$(NAME)/defaults $(OSX)/Resources/defaults 
	ln -sf `pwd`/$(NAME)/application.ini $(OSX)/Resources/application.ini
	ln -sf `pwd`/$(NAME)/chrome.manifest $(OSX)/Resources/chrome.manifest

build:	clean build_osx build_win
	make dev

version:
	sed -E -i '' -e "s/^Version=.*$$/Version=$(VER)/" $(NAME)/application.ini
	sed -E -i '' -e "s/\\<em:version\\>([0-9\\.]*)\\<\\/em:version\\>/\\<em:version\\>$(VER)\\<\\/em:version\\>/" $(NAME)/install.rdf

build_osx: clean_osx version
	rsync -a $(NAME)/application.ini $(NAME)/chrome $(NAME)/defaults $(OSX)/Resources
	zip -rqy ../$(NAME)-osx-$(VER).zip $(NAME).app

build_win: version
	zip -rq ../$(NAME)-win-$(VER).zip $(NAME)

xpi:
	(cd $(NAME) && zip -rq ../$(NAME)-$(VER).xpi .)

clean: clean_osx
	rm -rf *.zip *.xpi ../$(NAME)-*.zip

clean_osx:
	rm -rf $(OSX)/Resources/chrome $(OSX)/Resources/application.ini $(OSX)/Resources/defaults


