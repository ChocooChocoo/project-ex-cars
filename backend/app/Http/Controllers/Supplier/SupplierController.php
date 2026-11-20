<?php

namespace App\Http\Controllers\Supplier;

use App\Enums\Role;
use App\Http\Controllers\Controller;
use App\Models\User;
use App\Notifications\SupplierAccountCreated;
use App\Services\AccountService;
use App\Services\FileService;
use App\Services\NotificationService;
use App\Support\Rules;
use Carbon\CarbonImmutable;
use Illuminate\Auth\Events\Registered;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;

/**
 * Process & Revision Notes Part 1 (lines 14-56): supplier accounts and the supplier's vehicle posts.
 *
 * A supplier reads only their own posts. Staff access is the Confidential Informant, the Marketing Specialist and
 * the CEO (line 56). A pending or rejected supplier gets 403 on every supplier endpoint.
 */
class SupplierController extends Controller
{
    public const MAX_PHOTOS = 8;

    /** Posts GCE may still act on: counted as "vehicles posted" on the supplier's dashboard. */
    private const OPEN_STATES = ['posted', 'proposed', 'approved', 'assigned'];

    public function __construct(private AccountService $accounts, private FileService $files, private NotificationService $notifications) {}

    /** AM/CEO, notes lines 36-39: the walk-in form plus the company name. The supplier sets their own password. */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'full_name' => Rules::fullName(),
            'email' => [...Rules::email(), 'unique:users,email'],
            'company_name' => ['required', 'string', 'max:200'],
        ], [...Rules::messages(), 'email.unique' => 'A user with this email address has already been registered', 'company_name.*' => 'Enter the supplier company name.']);

        $user = DB::transaction(function () use ($data, $request) {
            // ponytail: a random password nobody sees; the supplier sets the real one from the emailed link.
            $user = $this->accounts->create($data['email'], Str::password(40), trim($data['full_name']), Role::Supplier, $request->user(), verified: true, auditAction: 'supplier_account_created');
            DB::table('supplier_profiles')->insert(['user_id' => $user->id, 'company_name' => trim($data['company_name']), 'approval_state' => 'approved',
                'approved_by' => $request->user()->id, 'approved_at' => now(), 'created_at' => now(), 'updated_at' => now()]);

            return $user;
        });
        $user->notify(new SupplierAccountCreated(Password::broker()->createToken($user)));

        return response()->json(['id' => $user->id], 201);
    }

    /** Notes line 40: self-registration. The account waits for the Account Manager's approval. */
    public function register(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => [...Rules::email(), 'unique:users,email'],
            'password' => Rules::newPassword(),
            'full_name' => Rules::fullName(),
            'company_name' => ['required', 'string', 'max:200'],
            'accept_terms' => ['accepted'],
        ], [...Rules::messages(), 'email.unique' => 'This email is already registered. Please log in instead.',
            'company_name.*' => 'Enter your company name.', 'accept_terms.accepted' => 'You must agree to the Terms and Conditions.']);

        $user = DB::transaction(function () use ($data) {
            $user = $this->accounts->create($data['email'], $data['password'], trim($data['full_name']), Role::Supplier, actor: null, verified: false);
            $user->forceFill(['terms_accepted_at' => now()])->save();
            DB::table('supplier_profiles')->insert(['user_id' => $user->id, 'company_name' => trim($data['company_name']), 'approval_state' => 'pending',
                'created_at' => now(), 'updated_at' => now()]);

            return $user;
        });
        event(new Registered($user));
        $this->notifications->send(['role' => 'account_manager'], 'supplier_signup', 'New supplier to approve',
            "{$data['company_name']} signed up as a supplier. Approve or reject the account in Supplier approvals.", 'supplier_profiles', $user->id);

        return response()->json(['notice' => 'Check your email to verify your account. GCE approves supplier accounts before you can post.'], 201);
    }

    /** AM/CEO: suppliers with their approval state, pending first. */
    public function approvals(): JsonResponse
    {
        $rows = DB::table('supplier_profiles as s')->join('users as u', 'u.id', '=', 's.user_id')->leftJoin('profiles as p', 'p.id', '=', 's.user_id')
            ->orderByRaw("s.approval_state = 'pending' desc")->orderByDesc('s.created_at')->limit(200)
            ->get(['s.user_id', 's.company_name', 's.approval_state', 's.approved_at', 's.created_at', 'u.email', 'u.email_verified_at', 'p.full_name']);

        return response()->json(['suppliers' => $rows->map(fn ($r) => [
            'user_id' => $r->user_id, 'company_name' => $r->company_name, 'approval_state' => $r->approval_state, 'email' => $r->email,
            'email_verified' => $r->email_verified_at !== null, 'full_name' => $r->full_name,
            'created_at' => self::iso($r->created_at), 'approved_at' => self::iso($r->approved_at),
        ])->values()]);
    }

    public function decide(Request $request): JsonResponse
    {
        $data = $request->validate(['user_id' => ['required', 'uuid'], 'decision' => ['required', 'in:approved,rejected']], ['*' => 'Invalid decision.']);
        $updated = DB::table('supplier_profiles')->where('user_id', $data['user_id'])->where('approval_state', 'pending')
            ->update(['approval_state' => $data['decision'], 'approved_by' => $request->user()->id, 'approved_at' => now(), 'updated_at' => now()]);
        abort_if($updated === 0, 409, 'This supplier was already decided.');
        $this->accounts->audit($request->user(), 'supplier_'.$data['decision'], 'profile', $data['user_id'], 'Supplier account '.$data['decision']);
        $approved = $data['decision'] === 'approved';
        $this->notifications->send(['userId' => $data['user_id']], 'supplier_decision',
            $approved ? 'Your supplier account is approved' : 'Your supplier account was not approved',
            $approved ? 'You can now post vehicles for GCE.' : 'Contact GCE if you think this is a mistake.', 'supplier_profiles', $data['user_id']);

        return response()->json(['success' => true]);
    }

    /** Notes lines 44-50: the supplier's dashboard counts and their posts. */
    public function dashboard(Request $request): JsonResponse
    {
        $profile = self::approvedSupplierProfile($request->user());
        $posts = DB::table('supplier_vehicle_posts')->where('supplier_id', $request->user()->id)->orderByDesc('created_at')->get();

        return response()->json([
            'company_name' => $profile->company_name,
            'counts' => [
                // Every purchase GCE opened with this supplier (Phase 3 opens one sell transaction per assigned post).
                'transactions' => DB::table('transactions')->where('customer_id', $request->user()->id)->count(),
                'posted' => $posts->whereIn('state', self::OPEN_STATES)->count(),
                'purchased' => $posts->where('state', 'purchased')->count(),
            ],
            'posts' => $posts->map(fn ($p) => $this->pack($p))->values(),
        ]);
    }

    /** Notes lines 52-55: photos and details. No showroom listing; GCE buys it first. */
    public function storePost(Request $request): JsonResponse
    {
        self::approvedSupplierProfile($request->user());
        $data = $this->validatePost($request);
        $photos = $request->file('photos') ?? [];
        $photos = is_array($photos) ? array_values(array_filter($photos)) : [$photos];
        abort_if(count($photos) === 0, 422, 'Add at least one photo of the vehicle.');
        abort_if(count($photos) > self::MAX_PHOTOS, 422, 'Add at most '.self::MAX_PHOTOS.' photos.');

        $id = (string) Str::uuid();
        $stored = [];
        try {
            foreach ($photos as $photo) {
                $stored[] = $this->files->store($photo, 'supplier-posts', $request->user()->id, 'photos')['path'];
            }
            DB::table('supplier_vehicle_posts')->insert($data + ['id' => $id, 'supplier_id' => $request->user()->id, 'photos' => json_encode($stored),
                'state' => 'posted', 'created_at' => now(), 'updated_at' => now()]);
        } catch (\Throwable $e) {
            foreach ($stored as $path) {
                $this->files->delete('supplier-posts', $path);
            }
            throw $e;
        }
        $this->notifications->send(['role' => 'marketing_specialist'], 'supplier_post', 'New supplier vehicle',
            "{$data['year']} {$data['make']} {$data['model']} was posted by a supplier.", 'supplier_vehicle_posts', $id);

        return response()->json(['id' => $id], 201);
    }

    /** Details only, while GCE has not acted on the post yet. */
    public function updatePost(Request $request, string $id): JsonResponse
    {
        self::approvedSupplierProfile($request->user());
        $data = $this->validatePost($request);
        $updated = DB::table('supplier_vehicle_posts')->where('id', $id)->where('supplier_id', $request->user()->id)->where('state', 'posted')
            ->update($data + ['updated_at' => now()]);
        abort_if($updated === 0, 409, 'Only a posted vehicle that GCE has not reviewed yet can be edited.');

        return response()->json(['success' => true]);
    }

    public function withdrawPost(Request $request, string $id): JsonResponse
    {
        self::approvedSupplierProfile($request->user());
        $updated = DB::table('supplier_vehicle_posts')->where('id', $id)->where('supplier_id', $request->user()->id)->whereIn('state', ['posted', 'proposed', 'approved'])
            ->update(['state' => 'withdrawn', 'updated_at' => now()]);
        abort_if($updated === 0, 409, 'This vehicle can no longer be withdrawn.');

        return response()->json(['success' => true]);
    }

    /** CI, MS, CEO: every post that was not withdrawn, with the supplier's company. */
    public function staffIndex(Request $request): JsonResponse
    {
        $rows = DB::table('supplier_vehicle_posts as v')->leftJoin('supplier_profiles as s', 's.user_id', '=', 'v.supplier_id')
            ->where('v.state', '!=', 'withdrawn')->orderByDesc('v.created_at')->limit(200)->get(['v.*', 's.company_name']);

        return response()->json(['role' => $request->user()->role()?->value, 'posts' => $rows->map(fn ($p) => $this->pack($p) + ['company_name' => $p->company_name])->values()]);
    }

    public function staffShow(string $id): JsonResponse
    {
        $post = self::post($id);

        return response()->json(['post' => $this->pack($post) + ['company_name' => $post->company_name, 'supplier_name' => $post->supplier_name, 'supplier_phone' => $post->supplier_phone]]);
    }

    /** A post with its supplier's company, name and phone, or 404. */
    public static function post(string $id): object
    {
        abort_unless(Str::isUuid($id), 404, 'Vehicle post not found.');
        $post = DB::table('supplier_vehicle_posts as v')->leftJoin('supplier_profiles as s', 's.user_id', '=', 'v.supplier_id')
            ->leftJoin('profiles as p', 'p.id', '=', 'v.supplier_id')->where('v.id', $id)
            ->first(['v.*', 's.company_name', 'p.full_name as supplier_name', 'p.phone as supplier_phone']);
        abort_unless($post, 404, 'Vehicle post not found.');

        return $post;
    }

    /** The supplier's own profile, or 403 while it is pending or rejected. */
    public static function approvedSupplierProfile(User $user): object
    {
        $profile = DB::table('supplier_profiles')->where('user_id', $user->id)->first();
        abort_unless($user->hasRole('supplier') && $profile, 403, 'Only suppliers can use the supplier portal.');
        abort_unless($profile->approval_state === 'approved', 403, $profile->approval_state === 'pending'
            ? "Your supplier account is waiting for GCE's approval." : 'Your supplier account was not approved.');

        return $profile;
    }

    private function validatePost(Request $request): array
    {
        $data = $request->validate([
            'make' => ['required', 'string', 'max:80'],
            'model' => ['required', 'string', 'max:80'],
            'year' => ['required', 'integer', 'min:1980', 'max:'.((int) date('Y') + 1)],
            'mileage' => ['required', 'integer', 'min:0', 'max:2000000'],
            'asking_price' => ['required', 'numeric', 'min:1', 'max:9999999999'],
            'description' => ['nullable', 'string', 'max:2000'],
        ], ['year.*' => 'Enter a model year from 1980.', 'asking_price.*' => 'Enter the asking price.']);

        return ['make' => trim($data['make']), 'model' => trim($data['model']), 'year' => (int) $data['year'], 'mileage' => (int) $data['mileage'],
            'asking_price' => $data['asking_price'], 'description' => isset($data['description']) ? trim($data['description']) : null];
    }

    /** One post for the browser, with short-lived photo links. */
    public function pack(object $p): array
    {
        $photos = json_decode((string) $p->photos, true) ?: [];

        return [
            'id' => $p->id, 'make' => $p->make, 'model' => $p->model, 'year' => (int) $p->year, 'mileage' => (int) $p->mileage,
            'asking_price' => (float) $p->asking_price, 'description' => $p->description, 'state' => $p->state,
            'photos' => array_map(fn ($path) => $this->files->signedUrl('supplier-posts', $path), $photos),
            'created_at' => self::iso($p->created_at), 'updated_at' => self::iso($p->updated_at),
        ];
    }

    private static function iso(mixed $value): ?string
    {
        return $value ? CarbonImmutable::parse($value, 'UTC')->toJSON() : null;
    }
}
