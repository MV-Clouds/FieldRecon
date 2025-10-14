public with sharing class BillingDetailsPageController {

    @AuraEnabled
    public static BillDataWrapper getBillingsData(String billingId) {
        try {
            BillDataWrapper wrapper = new BillDataWrapper();

            // Query Billing record
            wfrecon__Billing__c bill = [
                SELECT Id, Name, wfrecon__Job__r.wfrecon__Retainage__c, wfrecon__Retainage_on_Bill__c, wfrecon__Job__r.wfrecon__Total_Contract_Price__c, wfrecon__Job__r.wfrecon__Total_Change_Order_Value__c, 
                       wfrecon__Contract_Sum_to_Date__c, wfrecon__Total_Completed_and_Stored_to_Date__c, wfrecon__Amount__c, wfrecon__Total_Amount_Earned_Less_Retainage__c,
                       wfrecon__Current_Payment_Amount_Due__c, wfrecon__Balance_to_Finish_Retainage__c, wfrecon__Account__r.Name, wfrecon__Application_Number__c, wfrecon__Billing_Reference_Number__c,
                       wfrecon__Is_Retainage_Billing__c, wfrecon__Previous_Bill__c, wfrecon__Previous_Billed_Amount__c, wfrecon__Sent_Date__c, wfrecon__Start_Date__c, wfrecon__End_Date__c, wfrecon__Status__c,
                       wfrecon__Job__r.Name, wfrecon__Job__r.wfrecon__Job_Name__c, wfrecon__Job__r.wfrecon__Account__r.Name, wfrecon__Payment_Due_Date__c
                FROM wfrecon__Billing__c
                WHERE Id = :billingId
                WITH USER_MODE
                LIMIT 1
            ];

            // Populate Billing details in wrapper with null checks and default values
            wrapper.billDetails = new BillWrapper();
            wrapper.billDetails.Id = bill.Id;
            wrapper.billDetails.Name = String.isNotBlank(bill.Name) ? bill.Name : '-';
            wrapper.billDetails.BillingReferenceNumber = String.isNotBlank(bill.wfrecon__Billing_Reference_Number__c) ? bill.wfrecon__Billing_Reference_Number__c : '-';
            wrapper.billDetails.ApplicationNumber = String.isNotBlank(bill.wfrecon__Application_Number__c) ? bill.wfrecon__Application_Number__c : '-';
            wrapper.billDetails.Status = String.isNotBlank(bill.wfrecon__Status__c) ? bill.wfrecon__Status__c : '-';
            wrapper.billDetails.StartDate = bill.wfrecon__Start_Date__c;
            wrapper.billDetails.EndDate = bill.wfrecon__End_Date__c;
            wrapper.billDetails.SentDate = bill.wfrecon__Sent_Date__c;
            wrapper.billDetails.AccountName = (bill.wfrecon__Account__r != null && String.isNotBlank(bill.wfrecon__Account__r.Name)) ? bill.wfrecon__Account__r.Name : '-';
            wrapper.billDetails.Amount = bill.wfrecon__Amount__c != null ? bill.wfrecon__Amount__c : 0.00;
            wrapper.billDetails.RetainageOnBill = bill.wfrecon__Retainage_on_Bill__c != null ? bill.wfrecon__Retainage_on_Bill__c : 0.00;
            wrapper.billDetails.TotalEarnedLessRetainage = bill.wfrecon__Total_Amount_Earned_Less_Retainage__c != null ? bill.wfrecon__Total_Amount_Earned_Less_Retainage__c : 0.00;
            wrapper.billDetails.TotalCompletedAndStoredToDate = bill.wfrecon__Total_Completed_and_Stored_to_Date__c != null ? bill.wfrecon__Total_Completed_and_Stored_to_Date__c : 0.00;
            wrapper.billDetails.ContractSumToDate = bill.wfrecon__Contract_Sum_to_Date__c != null ? bill.wfrecon__Contract_Sum_to_Date__c : 0.00;
            wrapper.billDetails.BalanceToFinishRetainage = bill.wfrecon__Balance_to_Finish_Retainage__c != null ? bill.wfrecon__Balance_to_Finish_Retainage__c : 0.00;
            wrapper.billDetails.IsRetainageBilling = bill.wfrecon__Is_Retainage_Billing__c != null ? bill.wfrecon__Is_Retainage_Billing__c : false;
            wrapper.billDetails.PreviousBill = bill.wfrecon__Previous_Bill__c;
            wrapper.billDetails.PreviousBilledAmount = bill.wfrecon__Previous_Billed_Amount__c != null ? bill.wfrecon__Previous_Billed_Amount__c : 0.00;
            wrapper.billDetails.jobRetainage = bill.wfrecon__Job__r.wfrecon__Retainage__c != null ? bill.wfrecon__Job__r.wfrecon__Retainage__c : 0.00;
            wrapper.billDetails.jobTotalContractPrice = bill.wfrecon__Job__r.wfrecon__Total_Contract_Price__c != null ? bill.wfrecon__Job__r.wfrecon__Total_Contract_Price__c : 0.00;
            wrapper.billDetails.jobTotalChangeOrderValue = bill.wfrecon__Job__r.wfrecon__Total_Change_Order_Value__c != null ? bill.wfrecon__Job__r.wfrecon__Total_Change_Order_Value__c : 0.00;
            wrapper.billDetails.JobName = String.isNotBlank(bill.wfrecon__Job__r.wfrecon__Job_Name__c) ? bill.wfrecon__Job__r.wfrecon__Job_Name__c : '-';
            wrapper.billDetails.JobNumber = String.isNotBlank(bill.wfrecon__Job__r.Name) ? bill.wfrecon__Job__r.Name : '-';
            wrapper.billDetails.PaymentDueDate = bill.wfrecon__Payment_Due_Date__c;

            // Query Billing Line Items directly
            List<wfrecon__Billing_Line_Item__c> billLineItems = [
                SELECT Id, wfrecon__Billing__c, wfrecon__Scope_Entry__c, wfrecon__Scope_Entry__r.Name, wfrecon__Scope_Entry_Type__c, wfrecon__Scope_Contract_Value__c,
                       wfrecon__Previous_Billed_Amount__c, wfrecon__Prev_Billed_Percent__c, wfrecon__This_Billing_Percent__c,
                       wfrecon__This_Billing_Amount__c, wfrecon__Total_Complete_Amount__c, wfrecon__Total_This_Billing_Amount__c,
                       wfrecon__Current_Billing_Complete__c, wfrecon__Due_This_Billing__c, wfrecon__Retainage_Percent_on_Bill_Line_Item__c,
                       wfrecon__Retainage_Amount_on_Bill_Line_Item__c, wfrecon__Retainge_On_Bill__c
                FROM wfrecon__Billing_Line_Item__c
                WHERE wfrecon__Billing__c = :billingId
            ];

            Decimal retainageCompletedToDate = 0; 
            Decimal totalDueThisBilling = 0; 
            for(wfrecon__Billing_Line_Item__c bli : billLineItems) { 
                retainageCompletedToDate += bli.wfrecon__Retainage_Amount_on_Bill_Line_Item__c; 
                totalDueThisBilling += bli.wfrecon__Due_This_Billing__c;
            }

            wrapper.billDetails.RetainageCompletedToDate = retainageCompletedToDate;
            wrapper.billDetails.TotalDueThisBilling = totalDueThisBilling;
            wrapper.billLineItems = billLineItems;

            return wrapper;

        } catch (Exception e) {
            System.debug('Error fetching billing data: ' + e.getMessage());
            throw new AuraHandledException(e.getMessage());
        }
    }

    @AuraEnabled
    public static String updateBillingDetails(String billingId, Map<String, Object> fieldValues) {
        try {
            wfrecon__Billing__c billing = [SELECT Id FROM wfrecon__Billing__c WHERE Id = :billingId WITH USER_MODE LIMIT 1];
            
            // Update fields based on the map values
            if (fieldValues.containsKey('Status')) {
                billing.wfrecon__Status__c = (String) fieldValues.get('Status');
            }
            if (fieldValues.containsKey('RetainageOnBill')) {
                billing.wfrecon__Retainage_on_Bill__c = (Decimal) fieldValues.get('RetainageOnBill');
            }
            if (fieldValues.containsKey('wfrecon__Sent_Date__c')) {
                billing.wfrecon__Sent_Date__c = (Date) fieldValues.get('wfrecon__Sent_Date__c');
            }
            if (fieldValues.containsKey('BillingReferenceNumber')) {
                billing.wfrecon__Billing_Reference_Number__c = (String) fieldValues.get('BillingReferenceNumber');
            }
            if (fieldValues.containsKey('ApplicationNumber')) {
                billing.wfrecon__Application_Number__c = (String) fieldValues.get('ApplicationNumber');
            }
            if (fieldValues.containsKey('StartDate')) {
                billing.wfrecon__Start_Date__c = (Date) fieldValues.get('StartDate');
            }
            if (fieldValues.containsKey('EndDate')) {
                billing.wfrecon__End_Date__c = (Date) fieldValues.get('EndDate');
            }
            if (fieldValues.containsKey('PaymentDueDate')) {
                billing.wfrecon__Payment_Due_Date__c = (Date) fieldValues.get('PaymentDueDate');
            }
            
            update billing;
            
            return 'SUCCESS';
        } catch (Exception e) {
            System.debug('Error updating billing details: ' + e.getMessage());
            throw new AuraHandledException(e.getMessage());
        }
    }

    @AuraEnabled
    public static String saveBillingLineItems(String billingId, List<Map<String, Object>> lineItemUpdates) {
        try {
            List<wfrecon__Billing_Line_Item__c> itemsToUpdate = new List<wfrecon__Billing_Line_Item__c>();
            
            for (Map<String, Object> line : lineItemUpdates) {
                String recordId = (String) line.get('Id');
                wfrecon__Billing_Line_Item__c lineItem = new wfrecon__Billing_Line_Item__c(Id = recordId);
                
                if (line.containsKey('wfrecon__This_Billing_Percent__c')) {
                    lineItem.wfrecon__This_Billing_Percent__c = (Decimal) line.get('wfrecon__This_Billing_Percent__c');
                }
                
                itemsToUpdate.add(lineItem);
            }
            
            if (!itemsToUpdate.isEmpty()) {
                update itemsToUpdate;
            }
            
            return 'SUCCESS';
        } catch (Exception e) {
            System.debug('Error saving billing line items: ' + e.getMessage());
            throw new AuraHandledException(e.getMessage());
        }
    }

    // ---------------------------
    // Top-level wrapper classes
    // ---------------------------
    public class BillDataWrapper {
        @AuraEnabled public BillWrapper billDetails { get; set; }
        @AuraEnabled public List<wfrecon__Billing_Line_Item__c> billLineItems { get; set; }

        public BillDataWrapper() {
            billDetails = new BillWrapper();
            billLineItems = new List<wfrecon__Billing_Line_Item__c>();
        }
    }

    public class BillWrapper {
        @AuraEnabled public Id Id;
        @AuraEnabled public String Name;
        @AuraEnabled public String BillingReferenceNumber;
        @AuraEnabled public String ApplicationNumber;
        @AuraEnabled public String Status;
        @AuraEnabled public Date StartDate;
        @AuraEnabled public Date EndDate;
        @AuraEnabled public Date SentDate;
        @AuraEnabled public String AccountName;
        @AuraEnabled public Decimal Amount;
        @AuraEnabled public Decimal RetainageOnBill;
        @AuraEnabled public Decimal TotalEarnedLessRetainage;
        @AuraEnabled public Decimal TotalCompletedAndStoredToDate;
        @AuraEnabled public Decimal RetainageCompletedToDate;
        @AuraEnabled public Decimal TotalDueThisBilling;
        @AuraEnabled public Decimal BalanceToFinishRetainage;
        @AuraEnabled public Decimal ContractSumToDate;
        @AuraEnabled public Boolean IsRetainageBilling;
        @AuraEnabled public Id PreviousBill;
        @AuraEnabled public Decimal PreviousBilledAmount;
        @AuraEnabled public Decimal jobRetainage;
        @AuraEnabled public Decimal jobTotalContractPrice;
        @AuraEnabled public Decimal jobTotalChangeOrderValue;
        @AuraEnabled public String JobName;
        @AuraEnabled public String JobNumber;
        @AuraEnabled public Date PaymentDueDate;

        public BillWrapper() {}
    }
}