NAME=ElasticWolf
VER=$(shell awk -F= '{if($$1=="Version"){gsub(/[\"\",;]+/,"",$$2);print $$2;}}' $(NAME)/application.ini)
OSX=$(NAME).app/Contents

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
	for f in ../*.zip ../*.xpi; do md5sum $$f > $$f.md5;done

prepare: clean prepare_osx

prepare_osx: clean_osx
	cp -a $(NAME)/application.ini $(NAME)/chrome $(NAME)/chrome.manifest $(NAME)/defaults $(OSX)/Resources

build_osx: prepare_osx
	zip -rqy ../$(NAME)-osx-$(VER).zip $(NAME).app -x '**/.DS_Store'

build_win:
	zip -rq ../$(NAME)-win-$(VER).zip $(NAME) -x '**/.DS_Store'

build_linux:
	zip -rq ../$(NAME)-linux-$(VER).zip $(NAME) -x '*/xulrunner/**' '*.exe' '*.dll' '**/.DS_Store'
	
xpi:
	(cd $(NAME) && zip -rq ../../$(NAME)-$(VER).xpi . -x 'xulrunner/**' '**.DS_Store')

clean: clean_osx
	rm -rf *.zip *.xpi ../$(NAME)-*.zip ../*.xpi -x '**.DS_Store'

clean_osx:
	rm -rf $(OSX)/Resources/chrome $(OSX)/Resources/application.ini $(OSX)/Resources/defaults $(OSX)/Resources/chrome.manifest

put:	build
	./s3upload www.elasticwolf.com/Releases/ElasticWolf-osx-$(VER).zip ../ElasticWolf-osx-$(VER).zip 
	./s3upload www.elasticwolf.com/Releases/ElasticWolf-osx-$(VER).zip.md5 ../ElasticWolf-osx-$(VER).zip.md5
	./s3upload www.elasticwolf.com/Releases/ElasticWolf-win-$(VER).zip ../ElasticWolf-win-$(VER).zip 
	./s3upload www.elasticwolf.com/Releases/ElasticWolf-win-$(VER).zip.md5 ../ElasticWolf-win-$(VER).zip.md5
	./s3upload www.elasticwolf.com/Releases/ElasticWolf-linux-$(VER).zip ../ElasticWolf-linux-$(VER).zip 
	./s3upload www.elasticwolf.com/Releases/ElasticWolf-linux-$(VER).zip.md5 ../ElasticWolf-linux-$(VER).zip.md5
	[ -f ../ElasticWolf-$(VER).xpi ] && ./s3upload www.elasticwolf.com/Releases/ElasticWolf-$(VER).xpi ../ElasticWolf-$(VER).xpi
	[ -f ../ElasticWolf-$(VER).xpi ] && ./s3upload www.elasticwolf.com/Releases/ElasticWolf-$(VER).xpi.md5 ../ElasticWolf-$(VER).xpi.md5
	./s3upload www.elasticwolf.com/index.html $(VER)

.PHONY: clean_osx dev
