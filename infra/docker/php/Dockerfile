# Laravel API as PHP-FPM.
#
# The image carries no secrets: every credential arrives through the environment
# at run time, which is what makes the same image safe to promote from staging
# to production.
FROM php:8.4-fpm-alpine AS base

RUN apk add --no-cache icu-dev oniguruma-dev libzip-dev $PHPIZE_DEPS \
    && docker-php-ext-install -j"$(nproc)" pdo_mysql bcmath intl opcache zip \
    && apk del $PHPIZE_DEPS

# Sensible production OPcache settings; overridden by PHP_OPCACHE_* if needed.
RUN { \
      echo 'opcache.enable=1'; \
      echo 'opcache.memory_consumption=192'; \
      echo 'opcache.max_accelerated_files=20000'; \
      echo 'opcache.validate_timestamps=0'; \
    } > /usr/local/etc/php/conf.d/opcache.ini \
    && { \
      echo 'expose_php=Off'; \
      echo 'upload_max_filesize=64M'; \
      echo 'post_max_size=68M'; \
      echo 'memory_limit=512M'; \
    } > /usr/local/etc/php/conf.d/app.ini

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html

# Dependencies first, so a code change does not invalidate the vendor layer.
COPY apps/api/composer.json apps/api/composer.lock ./
RUN composer install --no-dev --no-scripts --no-autoloader --prefer-dist --no-interaction

COPY apps/api ./
# Seed content lives outside the app; the compose file mounts it read-only.
COPY content /content

RUN composer dump-autoload --optimize --classmap-authoritative \
    && chown -R www-data:www-data storage bootstrap/cache

USER www-data

EXPOSE 9000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
    CMD php -r 'exit(0);'

CMD ["php-fpm"]
