<?php

use Illuminate\Contracts\Console\Kernel;

// No exception messages: database connection errors can contain credentials.
try {
    [$script, $stage, $production, $allowMigrations] = $argv;
    require $stage.'/vendor/autoload.php';
    $app = require $stage.'/bootstrap/app.php';
    $app->useEnvironmentPath($production);
    $app->make(Kernel::class)->bootstrap();
    $checks = [
        'APP_ENV must be production' => $app->environment('production'),
        'APP_DEBUG must be false' => ! config('app.debug'),
        'APP_KEY must already be configured' => (bool) config('app.key'),
        'APP_URL must be the HTTPS API origin' => config('app.url') === 'https://api.nuruzzaman.com.bd',
        'SESSION_SECURE_COOKIE must be true' => config('session.secure') === true,
        'SESSION_DOMAIN must cover both domains' => in_array(config('session.domain'), ['nuruzzaman.com.bd', '.nuruzzaman.com.bd'], true),
        'SESSION_COOKIE must match the frontend' => config('session.cookie') === 'nuruzzaman_session',
        'SANCTUM_STATEFUL_DOMAINS must include the frontend' => in_array('nuruzzaman.com.bd', config('sanctum.stateful', []), true),
        'CORS_ALLOWED_ORIGINS must include the frontend' => in_array('https://nuruzzaman.com.bd', config('cors.allowed_origins', []), true),
        'Use MySQL/MariaDB' => in_array(config('database.default'), ['mysql', 'mariadb'], true),
    ];
    foreach ($checks as $message => $passed) {
        if (! $passed) {
            fwrite(STDERR, "API configuration: $message\n");
            exit(1);
        }
    }
    $db = $app->make('db')->connection();
    $db->select('SELECT 1');
    $ran = $db->getSchemaBuilder()->hasTable('migrations') ? $db->table('migrations')->pluck('migration')->all() : [];
    $pending = array_diff(array_map(fn ($file) => basename($file, '.php'), glob($stage.'/database/migrations/*.php')), $ran);
    echo 'Database connection verified; pending migrations: '.count($pending).PHP_EOL;
    if ($pending && $allowMigrations !== '1') {
        fwrite(STDERR, "Review pending migrations and a database backup, then enable NB_RUN_MIGRATIONS. No live files changed.\n");
        exit(1);
    }
} catch (Throwable $error) {
    fwrite(STDERR, "API bootstrap/database check failed. Inspect private server configuration and logs; credentials were not printed.\n");
    exit(1);
}
