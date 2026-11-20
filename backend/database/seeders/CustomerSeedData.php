<?php

namespace Database\Seeders;

final class CustomerSeedData
{
    private const NAMES = [
        'Mariel Ramos', 'Paolo Rivera', 'Janelle Garcia', 'Rafael Mercado', 'Camille Uy', 'Emmanuel Soriano',
        'Clarisse Dizon', 'Gabriel Valdez', 'Mika Santos', 'Adrian Flores', 'Bianca Salazar', 'Joshua Velasco',
        'Teresa Villamor', 'Vincent Robles', 'Katrina Ocampo', 'Miguel Padilla', 'Althea Cruz', 'Francis Reyes',
        'Denise Bonifacio', 'Leandro Perez', 'Abigail Torres', 'Patrick Bautista', 'Irene de Leon', 'Marco Castillo',
        'Joanna Cortez', 'Nico Manansala', 'Janine Reyes', 'Jose Consunji', 'Samantha Go', 'Enrico Santiago',
    ];

    private const LOCATIONS = [
        ['Salawag', 'Dasmariñas', 'Cavite'], ['Buhay na Tubig', 'Imus', 'Cavite'], ['Molino III', 'Bacoor', 'Cavite'],
        ['Manggahan', 'General Trias', 'Cavite'], ['Inchican', 'Silang', 'Cavite'], ['Kaybagal South', 'Tagaytay', 'Cavite'],
        ['Canlubang', 'Calamba', 'Laguna'], ['Balibago', 'Santa Rosa', 'Laguna'], ['San Antonio', 'Biñan', 'Laguna'],
        ['San Rafael', 'San Pablo', 'Laguna'], ['Tambo', 'Lipa', 'Batangas'], ['Alangilan', 'Batangas City', 'Batangas'],
        ['Mayamot', 'Antipolo', 'Rizal'], ['Gulang-Gulang', 'Lucena', 'Quezon'],
    ];

    private const PREFERENCES = [
        [400000, 650000, 'Sedan', 'ride-hailing', 'financing', '₱30,000–₱45,000', 'Ride-hailing driver'],
        [750000, 1200000, 'MPV', 'family', 'financing', '₱55,000–₱80,000', 'Public school teacher'],
        [1000000, 1800000, 'SUV', 'family', 'bank_transfer', '₱95,000–₱140,000', 'Civil engineer'],
        [500000, 850000, 'Hatchback', 'first car', 'cash', '₱40,000–₱60,000', 'Medical technologist'],
        [850000, 1500000, 'Pickup', 'business', 'bank_transfer', '₱80,000–₱120,000', 'Building contractor'],
        [450000, 850000, 'Sedan', 'first car', 'financing', '₱45,000–₱65,000', 'Software developer'],
        [700000, 1100000, 'MPV', 'business', 'cash', '₱65,000–₱95,000', 'Catering operator'],
        [850000, 1550000, 'SUV', 'family', 'financing', '₱70,000–₱105,000', 'Logistics supervisor'],
        [450000, 780000, 'Hatchback', 'first car', 'bank_transfer', '₱42,000–₱60,000', 'Graphic designer'],
        [650000, 1150000, 'Sedan', 'family', 'cash', '₱55,000–₱90,000', 'Clinic administrator'],
    ];

    private const MOBILE_PREFIXES = ['0917', '0918', '0920', '0927', '0928', '0935', '0939', '0945', '0956', '0961', '0966', '0975', '0977', '0995', '0998'];

    public static function profiles(): array
    {
        $profiles = ['customer' => self::profile('Juan Dela Cruz', 0, 2)];
        foreach (self::NAMES as $i => $name) {
            $profiles['buyer_'.($i + 1)] = self::profile($name, $i + 1, $i);
        }

        return $profiles;
    }

    private static function profile(string $name, int $index, int $preference): array
    {
        [$barangay, $city, $province] = self::LOCATIONS[$index % count(self::LOCATIONS)];
        [$min, $max, $body, $use, $payment, $income, $occupation] = self::PREFERENCES[$preference % count(self::PREFERENCES)];

        return [
            'name' => $name,
            'phone' => self::MOBILE_PREFIXES[$index % count(self::MOBILE_PREFIXES)]
                .substr(sprintf('%03d', 100 + $index * 37), 0, 3).' '.substr(sprintf('%04d', 2000 + $index * 211), 0, 4),
            'address' => sprintf('Blk %d Lot %d, Brgy. %s, %s, %s', 1 + $index % 12, 2 + $index % 23, $barangay, $city, $province),
            'city' => $city,
            'budget_min' => $min,
            'budget_max' => $max,
            'body_type' => $body,
            'intended_use' => $use,
            'payment_method' => $payment,
            'income_band' => $income,
            'occupation' => $occupation,
        ];
    }
}
