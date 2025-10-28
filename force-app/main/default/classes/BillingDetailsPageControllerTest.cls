@IsTest
public with sharing class BillingDetailsPageControllerTest {

    @TestSetup
    static void setupData() {
        Account accountRecord = new Account(
            Name = 'Test Account'
        );
        insert accountRecord;

        wfrecon__Job__c jobRecord = new wfrecon__Job__c(
            wfrecon__Job_Name__c = 'Test Job',
            wfrecon__Account__c = accountRecord.Id,
            wfrecon__Retainage__c = 5.0
        );
        insert jobRecord;

        wfrecon__Billing__c billingRecord = new wfrecon__Billing__c(
            wfrecon__Job__c = jobRecord.Id,
            wfrecon__Account__c = accountRecord.Id,
            wfrecon__Retainage_on_Bill__c = 5.0,
            wfrecon__Status__c = 'Draft',
            wfrecon__Start_Date__c = Date.today().addDays(-30),
            wfrecon__End_Date__c = Date.today()
        );
        insert billingRecord;

        wfrecon__Scope_Entry__c scopeEntry = new wfrecon__Scope_Entry__c(
            Name = 'Scope Entry',
            wfrecon__Job__c = jobRecord.Id,
            wfrecon__Contract_Value__c = 1000.0,
            wfrecon__Type__c = 'Contract',
            wfrecon__Scope_Entry_Status__c = 'Approved'
        );
        insert scopeEntry;

        wfrecon__Billing_Line_Item__c billingLineItem = new wfrecon__Billing_Line_Item__c(
            wfrecon__Billing__c = billingRecord.Id,
            wfrecon__Scope_Entry__c = scopeEntry.Id,
            wfrecon__Scope_Contract_Amount__c = 1000.0,
            wfrecon__This_Billing_Percent__c = 50.0,
            wfrecon__Retainage_Percent_on_Bill_Line_Item__c = 5.0,
            wfrecon__Previous_Billed_Value__c = 0.0,
            wfrecon__Total_Retainage_Amount__c = 0.0,
            wfrecon__This_Retainage_Amount__c = 0.0,
            wfrecon__This_Billing_Value__c = 0.0
        );
        insert billingLineItem;
    }

    @IsTest
    static void testRetainageCascadeToLineItems() {
        wfrecon__Billing__c billingRecord = [
            SELECT Id
            FROM wfrecon__Billing__c
            LIMIT 1
        ];

        Map<String, Object> updateValues = new Map<String, Object>();
    updateValues.put('RetainageOnBill', Decimal.valueOf('8'));

        Test.startTest();
        String result = BillingDetailsPageController.updateBillingDetails(billingRecord.Id, updateValues);
        Test.stopTest();

        wfrecon__Billing_Line_Item__c updatedLineItem = [
            SELECT wfrecon__Retainage_Percent_on_Bill_Line_Item__c,
                   wfrecon__This_Retainage_Amount__c,
                   wfrecon__Total_Retainage_Amount__c,
                   wfrecon__This_Billing_Value__c,
                   wfrecon__Total_Billed_Value__c
            FROM wfrecon__Billing_Line_Item__c
            WHERE wfrecon__Billing__c = :billingRecord.Id
            LIMIT 1
        ];

        System.assertEquals('SUCCESS', result, 'The update call should succeed.');
        System.assertEquals(Decimal.valueOf('8'), updatedLineItem.wfrecon__Retainage_Percent_on_Bill_Line_Item__c,
            'Retainage percent should match the bill-level retainage.');
        System.assertEquals(Decimal.valueOf('80'), updatedLineItem.wfrecon__This_Retainage_Amount__c,
            'This retainage amount should be recalculated based on the new percent.');
        System.assertEquals(Decimal.valueOf('80'), updatedLineItem.wfrecon__Total_Retainage_Amount__c,
            'Total retainage should reflect the new retainage calculation.');
        System.assertEquals(Decimal.valueOf('420'), updatedLineItem.wfrecon__This_Billing_Value__c,
            'This billing value should be recalculated using the new retainage.');
        System.assertEquals(Decimal.valueOf('420'), updatedLineItem.wfrecon__Total_Billed_Value__c,
            'Total billed value should reflect the recalculated amount.');
    }
}