<?php

namespace Database\Seeders;

use App\Enums\Role as RoleEnum;
use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Seeder;

class RoleSeeder extends Seeder
{
    /** group => [permission => description] */
    private const PERMISSIONS = [
        'content' => [
            'posts.view' => 'See every article, including drafts',
            'posts.create' => 'Write new articles',
            'posts.update' => 'Edit any article',
            'posts.publish' => 'Publish or schedule articles',
            'posts.delete' => 'Move articles to trash',
            'pages.view' => 'See every page',
            'pages.manage' => 'Create and edit pages',
            'pages.publish' => 'Publish pages and record legal review',
            'media.manage' => 'Upload and edit media',
            'redirects.manage' => 'Manage 301 redirects',
        ],
        'commerce' => [
            'products.view' => 'See the catalogue',
            'products.manage' => 'Create products, variants and prices',
            'coupons.manage' => 'Manage discount codes',
            'orders.view' => 'See all orders',
            'orders.manage' => 'Change order status and re-run fulfilment',
            'orders.refund' => 'Request, approve and reject refunds',
            'downloads.manage' => 'Manage protected releases',
        ],
        'lms' => [
            'courses.view' => 'See every course',
            'courses.manage' => 'Create and edit courses and lessons',
            'courses.publish' => 'Publish courses',
            'enrollments.manage' => 'Grant and revoke enrolments',
        ],
        'support' => [
            'activation.review' => 'Review activation and refill requests',
            'support.manage' => 'Work on support tickets',
        ],
        'platform' => [
            'users.view' => 'See user accounts',
            'users.manage' => 'Edit user accounts',
            'settings.manage' => 'Change site settings',
            'audit.view' => 'Read the audit log',
        ],
    ];

    /** Super admin is intentionally absent: it implicitly holds everything. */
    private const ROLE_PERMISSIONS = [
        'admin' => ['*'],
        'editor' => [
            'posts.view', 'posts.create', 'posts.update', 'posts.publish', 'posts.delete',
            'pages.view', 'pages.manage', 'media.manage', 'redirects.manage',
            'courses.view', 'products.view',
        ],
        'instructor' => [
            'courses.view', 'courses.manage', 'enrollments.manage',
            'media.manage', 'posts.view', 'posts.create',
        ],
        'support' => [
            'orders.view', 'activation.review', 'support.manage',
            'users.view', 'products.view', 'courses.view',
        ],
        'student' => [],
        'customer' => [],
    ];

    public function run(): void
    {
        foreach (self::PERMISSIONS as $group => $permissions) {
            foreach ($permissions as $name => $description) {
                Permission::query()->updateOrCreate(
                    ['name' => $name],
                    ['group' => $group, 'description' => $description],
                );
            }
        }

        foreach (RoleEnum::cases() as $case) {
            $role = Role::query()->updateOrCreate(
                ['name' => $case->value],
                ['label' => $case->label()],
            );

            $names = self::ROLE_PERMISSIONS[$case->value] ?? [];

            if ($names === ['*']) {
                $role->permissions()->sync(Permission::query()->pluck('id'));

                continue;
            }

            $role->permissions()->sync(Permission::query()->whereIn('name', $names)->pluck('id'));
        }
    }
}
