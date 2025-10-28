@IsTest
public with sharing class PaymentDetailsPageControllerTest {
    
    // Test data constants
    private static final String TEST_ACCOUNT_NAME = 'Test Account';
    private static final String TEST_JOB_NAME = 'Test Job';
    private static final String TEST_SCOPE_ENTRY_NAME = 'Test Scope Entry';
    private static final String TEST_PAYMENT_REFERENCE = 'PAY-001';
    private static final Decimal TEST_CONTRACT_VALUE = 10000.00;
    private static final Decimal TEST_BILLING_VALUE = 5000.00;
    private static final Decimal TEST_AMOUNT_RECEIVED = 3000.00;

    @TestSetup
    static void setupTestData() {
        // Create Account
        Account testAccount = new Account(
            Name = TEST_ACCOUNT_NAME,
            BillingStreet = '123 Test Street',
            BillingCity = 'Test City',
            BillingState = 'Test State',
            BillingPostalCode = '12345'
        );
        insert testAccount;

        // Create Job
        wfrecon__Job__c testJob = new wfrecon__Job__c(
            wfrecon__Job_Name__c = TEST_JOB_NAME,
            wfrecon__Account__c = testAccount.Id,
            wfrecon__Retainage__c = 10.0
        );
        insert testJob;

        // Create Scope Entries
        List<wfrecon__Scope_Entry__c> scopeEntries = new List<wfrecon__Scope_Entry__c>();
        
        // Base Contract Scope Entry
        wfrecon__Scope_Entry__c baseContractEntry = new wfrecon__Scope_Entry__c(
            Name = TEST_SCOPE_ENTRY_NAME + ' - Base Contract',
            wfrecon__Job__c = testJob.Id,
            wfrecon__Contract_Value__c = TEST_CONTRACT_VALUE,
            wfrecon__Type__c = 'Contract',
            wfrecon__Scope_Entry_Status__c = 'Approved'
        );
        scopeEntries.add(baseContractEntry);

        // Change Order Scope Entry
        wfrecon__Scope_Entry__c changeOrderEntry = new wfrecon__Scope_Entry__c(
            Name = TEST_SCOPE_ENTRY_NAME + ' - Change Order',
            wfrecon__Job__c = testJob.Id,
            wfrecon__Contract_Value__c = 5000.00,
            wfrecon__Type__c = 'Change Order',
            wfrecon__Scope_Entry_Status__c = 'Approved'
        );
        scopeEntries.add(changeOrderEntry);
        
        insert scopeEntries;

        // Create Billing
        wfrecon__Billing__c testBilling = new wfrecon__Billing__c(
            wfrecon__Job__c = testJob.Id,
            wfrecon__Account__c = testAccount.Id,
            wfrecon__Status__c = 'Approved',
            wfrecon__Start_Date__c = Date.today().addDays(-30),
            wfrecon__End_Date__c = Date.today().addDays(-1)
        );
        insert testBilling;

        // Create Billing Line Items
        List<wfrecon__Billing_Line_Item__c> billingLineItems = new List<wfrecon__Billing_Line_Item__c>();
        
        wfrecon__Billing_Line_Item__c baseBillingLineItem = new wfrecon__Billing_Line_Item__c(
            wfrecon__Billing__c = testBilling.Id,
            wfrecon__Scope_Entry__c = baseContractEntry.Id,
            wfrecon__Scope_Contract_Amount__c = TEST_CONTRACT_VALUE,
            wfrecon__This_Billing_Value__c = TEST_BILLING_VALUE,
            wfrecon__This_Billing_Percent__c = 50.0
        );
        billingLineItems.add(baseBillingLineItem);

        wfrecon__Billing_Line_Item__c changeOrderBillingLineItem = new wfrecon__Billing_Line_Item__c(
            wfrecon__Billing__c = testBilling.Id,
            wfrecon__Scope_Entry__c = changeOrderEntry.Id,
            wfrecon__Scope_Contract_Amount__c = 5000.00,
            wfrecon__This_Billing_Value__c = 3750.00,
            wfrecon__This_Billing_Percent__c = 75.0
        );
        billingLineItems.add(changeOrderBillingLineItem);
        
        insert billingLineItems;

        // Create Payment
        wfrecon__Payment__c testPayment = new wfrecon__Payment__c(
            wfrecon__Job__c = testJob.Id,
            wfrecon__Account__c = testAccount.Id,
            wfrecon__Billing__c = testBilling.Id,
            wfrecon__Payment_Reference__c = TEST_PAYMENT_REFERENCE,
            wfrecon__Payment_Received_Date__c = Date.today()
        );
        insert testPayment;

        // Create Payment Line Items
        List<wfrecon__Payment_Line_Item__c> paymentLineItems = new List<wfrecon__Payment_Line_Item__c>();
        
        wfrecon__Payment_Line_Item__c basePaymentLineItem = new wfrecon__Payment_Line_Item__c(
            wfrecon__Payment__c = testPayment.Id,
            wfrecon__Billing_Line_Item__c = baseBillingLineItem.Id,
            wfrecon__Scope_Entry__c = baseContractEntry.Id,
            wfrecon__Amount_Received__c = TEST_AMOUNT_RECEIVED
        );
        paymentLineItems.add(basePaymentLineItem);

        wfrecon__Payment_Line_Item__c changeOrderPaymentLineItem = new wfrecon__Payment_Line_Item__c(
            wfrecon__Payment__c = testPayment.Id,
            wfrecon__Billing_Line_Item__c = changeOrderBillingLineItem.Id,
            wfrecon__Scope_Entry__c = changeOrderEntry.Id,
            wfrecon__Amount_Received__c = 2000.00
        );
        paymentLineItems.add(changeOrderPaymentLineItem);
        
        insert paymentLineItems;
    }

    @IsTest
    static void testGetPaymentDataSuccess() {
        // Get test data
        wfrecon__Payment__c testPayment = [SELECT Id FROM wfrecon__Payment__c LIMIT 1];
        
        Test.startTest();
        PaymentDetailsPageController.PaymentDataWrapper result = PaymentDetailsPageController.getPaymentData(testPayment.Id);
        Test.stopTest();
    }

    @IsTest
    static void testGetPaymentDataWithMinimalData() {
        // Create minimal payment data without optional fields
        Account minimalAccount = new Account(Name = 'Minimal Account');
        insert minimalAccount;
        
        wfrecon__Job__c minimalJob = new wfrecon__Job__c(
            wfrecon__Account__c = minimalAccount.Id
        );
        insert minimalJob;
        
        wfrecon__Billing__c minimalBilling = new wfrecon__Billing__c(
            wfrecon__Job__c = minimalJob.Id,
            wfrecon__Account__c = minimalAccount.Id
        );
        insert minimalBilling;
        
        wfrecon__Payment__c minimalPayment = new wfrecon__Payment__c(
            wfrecon__Job__c = minimalJob.Id,
            wfrecon__Account__c = minimalAccount.Id,
            wfrecon__Billing__c = minimalBilling.Id
        );
        insert minimalPayment;
        
        Test.startTest();
        PaymentDetailsPageController.PaymentDataWrapper result = PaymentDetailsPageController.getPaymentData(minimalPayment.Id);
        Test.stopTest();
    }

    @IsTest
    static void testUpdatePaymentDetailsSuccess() {
        // Get test data
        wfrecon__Payment__c testPayment = [SELECT Id FROM wfrecon__Payment__c LIMIT 1];
        
        // Prepare update data
        Map<String, Object> updateFields = new Map<String, Object>();
        updateFields.put('PaymentReference', 'UPDATED-PAY-001');
        updateFields.put('PaymentReceivedDate', String.valueOf(Date.today().addDays(1)));
        
        Test.startTest();
        String result = PaymentDetailsPageController.updatePaymentDetails(testPayment.Id, updateFields);
        Test.stopTest();
    }

    @IsTest
    static void testUpdatePaymentDetailsPartialUpdate() {
        // Get test data
        wfrecon__Payment__c testPayment = [SELECT Id FROM wfrecon__Payment__c LIMIT 1];
        
        // Prepare partial update data (only payment reference)
        Map<String, Object> updateFields = new Map<String, Object>();
        updateFields.put('PaymentReference', 'PARTIAL-UPDATE-001');
        
        Test.startTest();
        String result = PaymentDetailsPageController.updatePaymentDetails(testPayment.Id, updateFields);
        Test.stopTest();
    }

    @IsTest
    static void testSavePaymentLineItemsSuccess() {
        // Get test data
        List<wfrecon__Payment_Line_Item__c> paymentLineItems = [
            SELECT Id, wfrecon__Amount_Received__c, Payment__c 
            FROM wfrecon__Payment_Line_Item__c 
            ORDER BY wfrecon__Amount_Received__c DESC
        ];
        
        // Prepare line item updates
        List<Map<String, Object>> lineItemUpdates = new List<Map<String, Object>>();
        
        Map<String, Object> update1 = new Map<String, Object>();
        update1.put('Id', paymentLineItems[0].Id);
        update1.put('AmountReceived', 4000.00);
        lineItemUpdates.add(update1);
        
        Map<String, Object> update2 = new Map<String, Object>();
        update2.put('Id', paymentLineItems[1].Id);
        update2.put('AmountReceived', 2500.00);
        lineItemUpdates.add(update2);
        
        Test.startTest();
        String result = PaymentDetailsPageController.savePaymentLineItems(paymentLineItems[0].wfrecon__Payment__c, lineItemUpdates);
        Test.stopTest();
    }

    @IsTest
    static void testSavePaymentLineItemsWithNullValues() {
        // Get test data
        List<wfrecon__Payment_Line_Item__c> paymentLineItems = [
            SELECT Id, wfrecon__Amount_Received__c, wfrecon__Payment__c 
            FROM wfrecon__Payment_Line_Item__c 
            LIMIT 1
        ];
        
        // Prepare line item update with null value
        List<Map<String, Object>> lineItemUpdates = new List<Map<String, Object>>();
        
        Map<String, Object> update1 = new Map<String, Object>();
        update1.put('Id', paymentLineItems[0].Id);
        update1.put('AmountReceived', null);
        lineItemUpdates.add(update1);
        
        Test.startTest();
        String result = PaymentDetailsPageController.savePaymentLineItems(paymentLineItems[0].wfrecon__Payment__c, lineItemUpdates);
        Test.stopTest();
    }

    @IsTest
    static void testSavePaymentLineItemsWithEmptyList() {
        // Get test data
        wfrecon__Payment__c testPayment = [SELECT Id FROM wfrecon__Payment__c LIMIT 1];
        
        List<Map<String, Object>> emptyUpdates = new List<Map<String, Object>>();
        
        Test.startTest();
        String result = PaymentDetailsPageController.savePaymentLineItems(testPayment.Id, emptyUpdates);
        Test.stopTest();
    }

    @IsTest
    static void testSavePaymentLineItemsWithInvalidIds() {
        // Get test data
        wfrecon__Payment__c testPayment = [SELECT Id FROM wfrecon__Payment__c LIMIT 1];
        
        // Prepare line item updates with null/invalid IDs
        List<Map<String, Object>> lineItemUpdates = new List<Map<String, Object>>();
        
        Map<String, Object> update1 = new Map<String, Object>();
        update1.put('Id', null);
        update1.put('AmountReceived', 1000.00);
        lineItemUpdates.add(update1);
        
        Map<String, Object> update2 = new Map<String, Object>();
        update2.put('AmountReceived', 2000.00); // No Id field
        lineItemUpdates.add(update2);
        
        Test.startTest();
        String result = PaymentDetailsPageController.savePaymentLineItems(testPayment.Id, lineItemUpdates);
        Test.stopTest();
    }

    @IsTest
    static void testGetPaymentDataInvalidId() {
        // Create a fake ID that doesn't exist
        String fakeId = 'a0X' + '0'.repeat(15);
        
        Test.startTest();
        try {
            PaymentDetailsPageController.getPaymentData(fakeId);
        } catch (AuraHandledException e) {
            // Expected exception due to invalid ID
            System.assertNotEquals(null, e.getMessage());
        }
        Test.stopTest();
    }

    @IsTest
    static void testUpdatePaymentDetailsInvalidId() {
        // Create a fake ID that doesn't exist
        String fakeId = 'a0X' + '0'.repeat(15);
        
        Map<String, Object> updateFields = new Map<String, Object>();
        updateFields.put('PaymentReference', 'TEST-REF');
        
        Test.startTest();
        try {
            PaymentDetailsPageController.updatePaymentDetails(fakeId, updateFields);
        } catch (AuraHandledException e) {
            // Expected exception due to invalid ID
            System.assertNotEquals(null, e.getMessage());
        }
        Test.stopTest();
    }

    @IsTest
    static void testSavePaymentLineItemsInvalidId() {
        // Create a fake ID that doesn't exist
        String fakePaymentId = 'a0X' + '0'.repeat(15);
        String fakeLineItemId = 'a0Y' + '0'.repeat(15);
        
        List<Map<String, Object>> lineItemUpdates = new List<Map<String, Object>>();
        Map<String, Object> update1 = new Map<String, Object>();
        update1.put('Id', fakeLineItemId);
        update1.put('AmountReceived', 1000.00);
        lineItemUpdates.add(update1);
        
        Test.startTest();
        String result = PaymentDetailsPageController.savePaymentLineItems(fakePaymentId, lineItemUpdates);
        Test.stopTest();
    }
}