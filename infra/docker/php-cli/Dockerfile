# PHP CLI toolchain for local development and the test suite.
#
# Same PHP version and extensions as the production image in ../php, so a
# migration or query that works here works there. It differs only in what it is
# for: this image carries no application code and expects the repository to be
# mounted, which is what lets it run artisan and phpunit against working files.
#
# The stock `composer` image was used before and has no pdo_mysql, so every
# database test failed with "could not find driver".
FROM php:8.4-cli-alpine

RUN apk add --no-cache icu-dev oniguruma-dev libzip-dev mysql-client $PHPIZE_DEPS \
    && docker-php-ext-install -j"$(nproc)" pdo_mysql bcmath intl zip \
    && apk del $PHPIZE_DEPS

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /repo/apps/api
