FROM nginx:1.27-alpine

RUN rm /etc/nginx/conf.d/default.conf
COPY infra/nginx/nuruzzaman.conf /etc/nginx/conf.d/nuruzzaman.conf
COPY infra/nginx/security-headers.conf /etc/nginx/conf.d/security-headers.conf

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
    CMD wget -q -O /dev/null http://127.0.0.1/up || exit 1
