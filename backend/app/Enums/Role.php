<?php

namespace App\Enums;

/** Mirrors src/lib/auth/roles.ts. One active role per account (user_roles.account_id is unique). */
enum Role: string
{
    case Customer = 'customer';
    case Ceo = 'ceo';
    case AccountManager = 'account_manager';
    case HeadAccountant = 'head_accountant';
    case ConfidentialInformant = 'confidential_informant';
    case MarketingSpecialist = 'marketing_specialist';
    case Mechanic = 'mechanic';
    case SalesManager = 'sales_manager';
    case HeadSecurity = 'head_security';
    case SuperAdmin = 'super_admin';

    /** Business staff. Super Admin is deliberately absent: IT support sees no business data. */
    public const STAFF = ['ceo', 'account_manager', 'head_accountant', 'confidential_informant', 'marketing_specialist', 'mechanic', 'sales_manager', 'head_security'];

    /** Roles a new employee account can get (never CEO). */
    public const EMPLOYEE = ['account_manager', 'head_accountant', 'confidential_informant', 'marketing_specialist', 'mechanic', 'sales_manager', 'head_security'];

    /** May open the staff transaction list/detail (roles.ts TRANSACTION_VIEWER_ROLES). */
    public const TRANSACTION_VIEWERS = ['ceo', 'account_manager', 'head_accountant', 'confidential_informant', 'sales_manager', 'marketing_specialist'];

    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }

    public function label(): string
    {
        return match ($this) {
            self::Ceo => 'CEO',
            default => ucwords(str_replace('_', ' ', $this->value)),
        };
    }
}
