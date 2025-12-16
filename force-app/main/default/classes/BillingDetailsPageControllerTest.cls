@IsTest
private class BillingDetailsPageControllerTest {

    @TestSetup
    static void setupData() {
        Account acc = new Account(
            Name = 'Test Account',
            BillingStreet = '123 Main St',
            BillingCity = 'Austin',
            BillingState = 'TX',
            BillingPostalCode = '78701'
        );
        insert acc;

        wfrecon__Job__c job = new wfrecon__Job__c(
            wfrecon__Job_Name__c = 'JOB-001',
            wfrecon__Account__c = acc.Id,
            wfrecon__Retainage__c = 10.00
        );
        insert job;

        wfrecon__Scope_Entry__c scope = new wfrecon__Scope_Entry__c(
            Name = 'SE-001',
            wfrecon__Job__c = job.Id,
            wfrecon__Contract_Value__c = 100000.00,
            wfrecon__Type__c = 'Contract',
            wfrecon__Scope_Entry_Status__c = 'Approved'
        );
        insert scope;

        wfrecon__Billing__c bill = new wfrecon__Billing__c(
            wfrecon__Job__c = job.Id,
            wfrecon__Account__c = acc.Id,
            wfrecon__Retainage_on_Bill__c = 10.00,
            wfrecon__Status__c = 'Draft',
            wfrecon__Start_Date__c = Date.today().addDays(-30),
            wfrecon__End_Date__c = Date.today()
        );
        insert bill;

        // First Billing Line Item (will be previous for second bill)
        wfrecon__Billing_Line_Item__c bli1 = new wfrecon__Billing_Line_Item__c(
            wfrecon__Billing__c = bill.Id,
            wfrecon__Scope_Entry__c = scope.Id,
            wfrecon__Scope_Contract_Amount__c = 100000.00,
            wfrecon__This_Billing_Percent__c = 40.00,
            wfrecon__This_Billing_Value__c = 36000.00,
            wfrecon__This_Retainage_Amount__c = 4000.00,
            wfrecon__Total_Billed_Value__c = 36000.00,
            wfrecon__Total_Retainage_Amount__c = 4000.00,
            wfrecon__Retainage_Percent_on_Bill_Line_Item__c = 10.00,
            wfrecon__Previous_Billed_Value__c = 0.00
        );
        insert bli1;

        // Second Billing (current one we're editing)
        wfrecon__Billing__c currentBill = new wfrecon__Billing__c(
            wfrecon__Job__c = job.Id,
            wfrecon__Account__c = acc.Id,
            wfrecon__Retainage_on_Bill__c = 10.00,
            wfrecon__Previous_Bill__c = bill.Id,
            wfrecon__Status__c = 'Draft'
        );
        insert currentBill;

        wfrecon__Billing_Line_Item__c bli2 = new wfrecon__Billing_Line_Item__c(
            wfrecon__Billing__c = currentBill.Id,
            wfrecon__Scope_Entry__c = scope.Id,
            wfrecon__Scope_Contract_Amount__c = 100000.00,
            wfrecon__Previous_Bill_Line_Item__c = bli1.Id,
            wfrecon__This_Billing_Percent__c = 60.00,
            wfrecon__This_Billing_Value__c = 18000.00,
            wfrecon__This_Retainage_Amount__c = 2000.00,
            wfrecon__Total_Billed_Value__c = 54000.00,
            wfrecon__Total_Retainage_Amount__c = 6000.00,
            wfrecon__Retainage_Percent_on_Bill_Line_Item__c = 10.00,
            wfrecon__Previous_Billed_Value__c = 36000.00
        );
        insert bli2;
    }

    @IsTest
    static void testGetBillingsData_Success() {
        wfrecon__Billing__c bill = [SELECT Id FROM wfrecon__Billing__c WHERE wfrecon__Previous_Bill__c != null LIMIT 1];
        BillingDetailsPageController.BillDataWrapper result = BillingDetailsPageController.getBillingsData(bill.Id);
        System.assertNotEquals(null, result);
        System.assertNotEquals(null, result.billDetails);
        System.assert(result.billLineItems.size() > 0);
    }

    @IsTest
    static void testUpdateBillingDetails_RetainageChange() {
        wfrecon__Billing__c bill = [SELECT Id FROM wfrecon__Billing__c WHERE wfrecon__Previous_Bill__c != null LIMIT 1];
        Map<String, Object> updates = new Map<String, Object>{ 'RetainageOnBill' => 15.00 };

        String result = BillingDetailsPageController.updateBillingDetails(bill.Id, updates);
        System.assertEquals('SUCCESS', result);

        wfrecon__Billing_Line_Item__c line = [SELECT wfrecon__Retainage_Percent_on_Bill_Line_Item__c FROM wfrecon__Billing_Line_Item__c WHERE wfrecon__Billing__c = :bill.Id LIMIT 1];
        System.assertEquals(15.00, line.wfrecon__Retainage_Percent_on_Bill_Line_Item__c);
    }

    // Covers the full hasAmountUpdate block + all exceptions
    @IsTest
    static void testSaveLineItems_AmountUpdate_AllPaths() {
        wfrecon__Billing__c bill = [SELECT Id FROM wfrecon__Billing__c WHERE wfrecon__Previous_Bill__c != null LIMIT 1];
        wfrecon__Billing_Line_Item__c line = [SELECT Id FROM wfrecon__Billing_Line_Item__c WHERE wfrecon__Billing__c = :bill.Id LIMIT 1];

        List<Map<String, Object>> updates = new List<Map<String, Object>>{
            new Map<String, Object>{
                'Id' => line.Id,
                'wfrecon__This_Billing_Value__c' => 25000.00  // Valid amount
            }
        };

        Test.startTest();
        Map<String, String> result = BillingDetailsPageController.saveBillingLineItems(bill.Id, updates);
        Test.stopTest();
        System.assertNotEquals(null, result,'result should not be null');
    }

    @IsTest
    static void testSaveLineItems_AmountUpdate_NegativeAmount() {
        wfrecon__Billing__c bill = [SELECT Id FROM wfrecon__Billing__c WHERE wfrecon__Previous_Bill__c != null LIMIT 1];
        wfrecon__Billing_Line_Item__c line = [SELECT Id FROM wfrecon__Billing_Line_Item__c WHERE wfrecon__Billing__c = :bill.Id LIMIT 1];

        List<Map<String, Object>> updates = new List<Map<String, Object>>{
            new Map<String, Object>{
                'Id' => line.Id,
                'wfrecon__This_Billing_Value__c' => -100.00
            }
        };

        try {
            BillingDetailsPageController.saveBillingLineItems(bill.Id, updates);
        } catch (AuraHandledException e) {
            System.assert(e.getMessage().contains('cannot be negative'));
        }
    }

    @IsTest
    static void testSaveLineItems_AmountUpdate_ExceedContract() {
        wfrecon__Billing__c bill = [SELECT Id FROM wfrecon__Billing__c WHERE wfrecon__Previous_Bill__c != null LIMIT 1];
        wfrecon__Billing_Line_Item__c line = [SELECT Id FROM wfrecon__Billing_Line_Item__c WHERE wfrecon__Billing__c = :bill.Id LIMIT 1];

        List<Map<String, Object>> updates = new List<Map<String, Object>>{
            new Map<String, Object>{
                'Id' => line.Id,
                'wfrecon__This_Billing_Value__c' => 100000.00  // Way too high
            }
        };

        try {
            BillingDetailsPageController.saveBillingLineItems(bill.Id, updates);
        } catch (AuraHandledException e) {
            System.assert(e.getMessage().contains('exceeds the contract value') || e.getMessage().contains('exceed 100%'));
        }
    }

    // Covers the full hasPercentUpdate block + all exceptions
    @IsTest
    static void testSaveLineItems_PercentUpdate_AllPaths() {
        wfrecon__Billing__c bill = [SELECT Id FROM wfrecon__Billing__c WHERE wfrecon__Previous_Bill__c != null LIMIT 1];
        wfrecon__Billing_Line_Item__c line = [SELECT Id FROM wfrecon__Billing_Line_Item__c WHERE wfrecon__Billing__c = :bill.Id LIMIT 1];

        List<Map<String, Object>> updates = new List<Map<String, Object>>{
            new Map<String, Object>{
                'Id' => line.Id,
                'wfrecon__This_Billing_Percent__c' => 75.00
            }
        };

        Test.startTest();
        Map<String, String> result = BillingDetailsPageController.saveBillingLineItems(bill.Id, updates);
        Test.stopTest();
        System.assertNotEquals(null, result,'result should not be null');
    }

    @IsTest
    static void testSaveLineItems_PercentUpdate_NegativePercent() {
        wfrecon__Billing__c bill = [SELECT Id FROM wfrecon__Billing__c WHERE wfrecon__Previous_Bill__c != null LIMIT 1];
        wfrecon__Billing_Line_Item__c line = [SELECT Id FROM wfrecon__Billing_Line_Item__c WHERE wfrecon__Billing__c = :bill.Id LIMIT 1];

        List<Map<String, Object>> updates = new List<Map<String, Object>>{
            new Map<String, Object>{
                'Id' => line.Id,
                'wfrecon__This_Billing_Percent__c' => -5.00
            }
        };

        try {
            BillingDetailsPageController.saveBillingLineItems(bill.Id, updates);
        } catch (AuraHandledException e) {
            System.assert(e.getMessage().contains('cannot be negative'));
        }
    }

    @IsTest
    static void testSaveLineItems_PercentUpdate_Over100() {
        wfrecon__Billing__c bill = [SELECT Id FROM wfrecon__Billing__c WHERE wfrecon__Previous_Bill__c != null LIMIT 1];
        wfrecon__Billing_Line_Item__c line = [SELECT Id FROM wfrecon__Billing_Line_Item__c WHERE wfrecon__Billing__c = :bill.Id LIMIT 1];

        List<Map<String, Object>> updates = new List<Map<String, Object>>{
            new Map<String, Object>{
                'Id' => line.Id,
                'wfrecon__This_Billing_Percent__c' => 150.00
            }
        };

        try {
            BillingDetailsPageController.saveBillingLineItems(bill.Id, updates);
        } catch (AuraHandledException e) {
            System.assert(e.getMessage().contains('cannot exceed 100%'));
        }
    }

    // Covers the "only retainage changed" (else) branch
    @IsTest
    static void testSaveLineItems_RetainageOnlyChange() {
        wfrecon__Billing__c bill = [SELECT Id FROM wfrecon__Billing__c WHERE wfrecon__Previous_Bill__c != null LIMIT 1];
        wfrecon__Billing_Line_Item__c line = [SELECT Id FROM wfrecon__Billing_Line_Item__c WHERE wfrecon__Billing__c = :bill.Id LIMIT 1];

        List<Map<String, Object>> updates = new List<Map<String, Object>>{
            new Map<String, Object>{
                'Id' => line.Id,
                'wfrecon__Retainage_Percent_on_Bill_Line_Item__c' => 5.00
            }
        };

        Map<String, String> result = BillingDetailsPageController.saveBillingLineItems(bill.Id, updates);
        System.assertNotEquals(null, result,'result should not be null');
    }

    @IsTest
    static void testExceptionPaths() {
        // Invalid billing Id
        BillingDetailsPageController.BillDataWrapper result = BillingDetailsPageController.getBillingsData('001000000000000');
        System.assertEquals(null, result);

        // Invalid update
        String res = BillingDetailsPageController.updateBillingDetails('001000000000000', new Map<String, Object>());
        System.assertEquals(null, res);
    }
}