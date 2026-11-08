<?php

namespace App\Enum;

enum DocumentType: string
{
    case BALANCE_SHEET = 'BALANCE_SHEET';
    case INCOME_STATEMENT = 'INCOME_STATEMENT';
    case INVOICE = 'INVOICE';
    case BANK_STATEMENT = 'BANK_STATEMENT';
    case FINANCIAL_FORECAST = 'FINANCIAL_FORECAST';
    case BUDGET = 'BUDGET';
    case TAX_RETURN = 'TAX_RETURN';
    case PAYROLL = 'PAYROLL';
    case REPORT = 'REPORT';
    case OTHER = 'OTHER';
}
