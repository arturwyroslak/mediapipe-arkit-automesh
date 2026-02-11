.PHONY: run stop clean build

run:
	docker-compose up

build:
	docker-compose up --build

stop:
	docker-compose down

clean:
	docker-compose down -v
	rm -rf backend/uploads/*
	rm -rf backend/processed/*
