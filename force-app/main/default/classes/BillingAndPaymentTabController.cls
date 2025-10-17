/**
* Class Name: BillingAndPaymentTabController
* Test Class: BillingAndPaymentTabControllerTest
* @description: Controller for Billing and Payment Tab
* Created Date: 12 Oct 2025
* Created By: Harsh Gandhi
*--------------------------------------------------------------------------------
* Modification History:
* Date Modified - Developer Name - Description
* 
**/
public with sharing class BillingAndPaymentTabController {

    /*
    *********************************************************
    @description     : Fetch Job Data
    @param           : {String} jobId - Job Record Id
    @return          : List<Job__c> - List of job details
    ********************************************************
    */
    @AuraEnabled
    public static List<Job__c> getJobData(String jobId){
        try {
            return [
                SELECT Id, Name, Job_Name__c, Retainage__c, Status__c, Account__c 
                FROM Job__c 
                WHERE Id = :jobId 
                WITH USER_MODE
            ];
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => 'BillingAndPaymentTabController', 'methodName' => 'getJobData', 'exceptionObj' => e, 'moreDetails' =>  e.getMessage()});
            throw new AuraHandledException(e.getMessage());
        }
    }

    /*
    *********************************************************
    @description     : Fetch Billing Data
    @param           : {String} jobId - Job Record Id
    @return          : BillingResponse - Custom response class containing billing details and status
    ********************************************************
    */
    @AuraEnabled
    public static BillingResponse getBillingsData(String jobId){
        try {
            BillingResponse response = new BillingResponse();

            // Step 1: Check for approved scope entries
            List<Scope_Entry__c> scopeEntries = [
                SELECT Id
                FROM Scope_Entry__c
                WHERE Job__c = :jobId
                AND Scope_Entry_Status__c = 'Approved'
                WITH USER_MODE
                LIMIT 1
            ];

            if (scopeEntries.isEmpty()) {
                response.hasApprovedScopeEntries = false;
                response.message = 'No approved scope entries found for this job.';
                response.billings = new List<Billing__c>();
                return response;
            }

            // Step 2: Fetch billings if approved scope entries exist
            List<Billing__c> billings = [
                SELECT Id, Name, Status__c, Job__r.Job_Name__c, Job__r.Retainage__c, Previous_Bill__c, Previous_Bill__r.Name,
                       Start_Date__c, End_Date__c, Sent_Date__c, Billing_Reference_Number__c
                FROM Billing__c
                WHERE Job__c = :jobId
                WITH USER_MODE
                ORDER BY Name DESC
            ];

            response.hasApprovedScopeEntries = true;
            response.billings = billings;
            response.message = billings.isEmpty() ? 'No billing records found for this job.' : null;

            return response;
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => 'BillingAndPaymentTabController', 'methodName' => 'getBillingsData', 'exceptionObj' => e, 'moreDetails' =>  e.getMessage()});
            throw new AuraHandledException(e.getMessage());
        }
    }

    /*
    *********************************************************
    @description     : Fetch Payment Data
    @param           : {String} jobId - Job Record Id
    @return          : PaymentResponse - Custom response class containing payment details and status
    ********************************************************
    */
    @AuraEnabled
    public static PaymentResponse getPaymentsData(String jobId){
        try {
            PaymentResponse response = new PaymentResponse();
            
            // Step 1: Check for approved billing records
            List<Billing__c> approvedBillings = [
                SELECT Id, Name
                FROM Billing__c
                WHERE Job__c = :jobId
                AND Status__c = 'Approved'
                WITH USER_MODE
            ];

            if (approvedBillings.isEmpty()) {
                response.hasApprovedBillings = false;
                response.message = 'No approved billing records found for this job. Payment creation is not allowed.';
                response.payments = new List<Payment__c>();
                response.approvedBillings = new List<Billing__c>();
                return response;
            }

            // Step 2: Fetch payments if approved billings exist
            List<Payment__c> payments = [
                SELECT Id, Name, Payment_Name__c, Job__r.Job_Name__c, Payment_Reference__c,
                       Payment_Received_Date__c, Payable_Amount_Received__c
                FROM Payment__c
                WHERE Job__c = :jobId
                WITH USER_MODE
                ORDER BY Name DESC
            ];

            response.hasApprovedBillings = true;
            response.payments = payments;
            response.approvedBillings = approvedBillings;
            response.message = payments.isEmpty() ? 'No payment records found for this job.' : null;

            return response;
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => 'BillingAndPaymentTabController', 'methodName' => 'getPaymentsData', 'exceptionObj' => e, 'moreDetails' =>  e.getMessage()});
            throw new AuraHandledException(e.getMessage());
        }
    }

    /*
    *********************************************************
    @description     : Create Billing Record
    @param           : {String} jobId - Job Record Id
    @param           : {Date} startDate - Start Date
    @param           : {Date} endDate - End Date
    @param           : {String} billingType - Billing Type (Regular Bill, Retainage Bill, Due Payment Bill)
    @param           : {String} prevBill - Previous Billing Record Id (Optional)
    @return          : String - SUCCESS
    ********************************************************
    */
    @AuraEnabled
    public static String createBilling(String jobId, Date startDate, Date endDate, String billingType, String prevBill){
        try {
            // 1. Get Job details
            Job__c job = [
                SELECT Id, Account__c, Retainage__c 
                FROM Job__c 
                WHERE Id = :jobId 
                LIMIT 1
            ];

            // 2. Create new Billing record
            Decimal billRetainage = job.Retainage__c;
            if (String.isNotBlank(prevBill)) {
                Billing__c previousBilling = [
                    SELECT Id, Retainage_on_Bill__c
                    FROM Billing__c
                    WHERE Id = :prevBill
                    LIMIT 1
                ];
                if (previousBilling.Retainage_on_Bill__c != null) {
                    billRetainage = previousBilling.Retainage_on_Bill__c;
                }
            }

            Billing__c newBilling = new Billing__c();
            newBilling.Job__c = jobId;
            newBilling.Account__c = job.Account__c;
            newBilling.Status__c = 'Draft';
            
            // Set Is_Retainage_Billing__c based on billingType
            newBilling.Is_Retainage_Billing__c = (billingType == 'Retainage Bill');
            
            // Set Billing_Type__c if field exists (optional)
            // newBilling.Billing_Type__c = billingType;
            
            newBilling.Retainage_on_Bill__c = billRetainage;
            newBilling.Start_Date__c = startDate;
            newBilling.End_Date__c = endDate;
            if (String.isNotBlank(prevBill)) {
                newBilling.Previous_Bill__c = prevBill;
            }
            insert newBilling;

            // 3. Prepare Previous Bill Line Item mapping
            Map<Id, Billing_Line_Item__c> prevBillItemMap = new Map<Id, Billing_Line_Item__c>();
            if (String.isNotBlank(prevBill)) {
                for (Billing_Line_Item__c prevItem : [
                    SELECT Id, Scope_Entry__c, Total_Complete_Percent__c, This_Billing_Percent__c, Remaining_Billing_Amount__c, Total_Retainage_Amount__c, Total_Billed_Value__c, Retainage_Percent_on_Bill_Line_Item__c
                    FROM Billing_Line_Item__c
                    WHERE Billing__c = :prevBill
                ]) {
                    if (prevItem.Scope_Entry__c != null) {
                        prevBillItemMap.put(prevItem.Scope_Entry__c, prevItem);
                    }
                }
            }

            // 4. Get Approved Scope Entries
            List<Scope_Entry__c> scopeEntries = [
                SELECT Id, Name, Contract_Value__c, Type__c, Scope_Entry_Status__c, Job__c, Completed_Percentage__c, Current_Complete_Value__c 
                FROM Scope_Entry__c 
                WHERE Job__c = :jobId AND Scope_Entry_Status__c = 'Approved'
                WITH USER_MODE
            ];

            // 5. Create Billing Line Items
            List<Billing_Line_Item__c> billLinesToInsert = new List<Billing_Line_Item__c>();
            for (Scope_Entry__c se : scopeEntries) {
                Billing_Line_Item__c newItem = new Billing_Line_Item__c();
                newItem.Billing__c = newBilling.Id;
                newItem.Scope_Entry__c = se.Id;
                newItem.Scope_Contract_Amount__c = se.Contract_Value__c;
                newItem.Scope_Complete__c = se.Completed_Percentage__c;
                Billing_Line_Item__c prevItem = prevBillItemMap.get(se.Id);
                Decimal lineRetainagePercent = (prevItem != null && prevItem.Retainage_Percent_on_Bill_Line_Item__c != null)
                    ? prevItem.Retainage_Percent_on_Bill_Line_Item__c
                    : billRetainage;
                newItem.Retainage_Percent_on_Bill_Line_Item__c = lineRetainagePercent;
                
                // If matching previous bill item exists
                if (prevItem != null) {
                    System.debug('prevItem: ' + prevItem);
                    System.debug('prevItem: ' + JSON.serialize(prevItem));
                    newItem.Previous_Bill_Line_Item__c = prevItem.Id;
                    
                    // Set This Billing Percent as max of Previous Total Complete % and Current Completed %
                    Decimal prevCompletePercent = prevItem.This_Billing_Percent__c != null ? prevItem.This_Billing_Percent__c : 0;
                    Decimal currentCompletePercent = se.Completed_Percentage__c != null ? se.Completed_Percentage__c : 0;
                    newItem.This_Billing_Percent__c = Math.max(prevCompletePercent, currentCompletePercent);

                    System.debug('prevItem.Remaining_Billing_Amount__c: ' + prevItem.Remaining_Billing_Amount__c);
                    System.debug('se.Completed_Percentage__c: ' + se.Completed_Percentage__c);

                    newItem.This_Retainage_Amount__c = (prevItem.Remaining_Billing_Amount__c * lineRetainagePercent) / 100;
                    newItem.Total_Retainage_Amount__c = prevItem.Total_Retainage_Amount__c + newItem.This_Retainage_Amount__c;
                    System.debug('newItem.Total_Retainage_Amount__c: ' + newItem.Total_Retainage_Amount__c);

                    System.debug('se.Contract_Value__c: ' + se.Contract_Value__c);
                    System.debug('newItem.This_Billing_Percent__c: ' + newItem.This_Billing_Percent__c);
                    System.debug('newItem.This_Retainage_Amount__c: ' + newItem.This_Retainage_Amount__c);
                    System.debug('prevItem.Total_Billed_Value__c: ' + prevItem.Total_Billed_Value__c);

                    newItem.This_Billing_Value__c = ((se.Contract_Value__c * newItem.This_Billing_Percent__c) / 100) - newItem.Total_Retainage_Amount__c - prevItem.Total_Billed_Value__c;
                    
                    System.debug('newItem.This_Billing_Value__c: ' + newItem.This_Billing_Value__c);

                    newItem.Total_Billed_Value__c = prevItem.Total_Billed_Value__c + newItem.This_Billing_Value__c;
                    
                    System.debug('newItem.Total_Billed_Value__c: ' + newItem.Total_Billed_Value__c);
                    newItem.Previous_Billed_Value__c = prevItem.Total_Billed_Value__c;
                    
                    System.debug('newItem.Previous_Billed_Value__c: ' + newItem.Previous_Billed_Value__c);

                    System.debug('newItem.This_Retainage_Amount__c: ' + newItem.This_Retainage_Amount__c);
                    System.debug('prevItem.Total_Retainage_Amount__c: ' + prevItem.Total_Retainage_Amount__c);
                    
                } else {
                    // No previous bill item, use current completed percentage
                    newItem.This_Billing_Percent__c = se.Completed_Percentage__c != null ? se.Completed_Percentage__c : 0;
                    newItem.This_Retainage_Amount__c = (se.Contract_Value__c * lineRetainagePercent) / 100;
                    newItem.Total_Retainage_Amount__c = newItem.This_Retainage_Amount__c;
                    newItem.This_Billing_Value__c = ((se.Contract_Value__c * newItem.This_Billing_Percent__c) / 100) - newItem.This_Retainage_Amount__c;
                    newItem.Total_Billed_Value__c = ((se.Contract_Value__c * newItem.This_Billing_Percent__c) / 100) - newItem.Total_Retainage_Amount__c;
                }              
                
                billLinesToInsert.add(newItem);
            }

            // 6. Insert all new billing line items
            if (!billLinesToInsert.isEmpty()) {
                insert billLinesToInsert;
            }

            return 'SUCCESS';
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => 'BillingAndPaymentTabController', 'methodName' => 'createBilling', 'exceptionObj' => e, 'moreDetails' =>  e.getMessage()});
            throw new AuraHandledException(e.getMessage());
        }
    }

    /*
    *********************************************************
    @description     : Create Payment Record
    @param           : {String} jobId - Job Record Id
    @param           : {String} billId - Billing Record Id
    @param           : {String} paymentReference - Payment Reference
    @param           : {Date} paymentDate - Payment Received Date
    @param           : {String} accountId - Account Id
    @return          : String - SUCCESS
    ********************************************************
    */
    @AuraEnabled
    public static string createPayment(String jobId, String billId, String paymentReference, Date paymentDate, String accountId){
        try {
            Payment__c p = new Payment__c();
            p.Job__c = jobId;
            p.Account__c = accountId;
            p.Billing__c = billId;
            p.Payment_Reference__c = paymentReference;
            p.Payment_Received_Date__c = paymentDate;
            insert p;

            List<Billing_Line_Item__c> bli = [
                SELECT Id, Scope_Entry__c 
                FROM Billing_Line_Item__c 
                WHERE Billing__c = :billId
                WITH USER_MODE
            ];

            List<Payment_Line_Item__c> pliToInsert = new List<Payment_Line_Item__c>();
            for (Billing_Line_Item__c bliItem : bli) {
                Payment_Line_Item__c pli = new Payment_Line_Item__c();
                pli.Payment__c = p.Id;
                pli.Billing_Line_Item__c = bliItem.Id;
                pli.Scope_Entry__c = bliItem.Scope_Entry__c;
                pliToInsert.add(pli);
            }

            if(pliToInsert.size() > 0) {
                insert pliToInsert;
            }

            return 'SUCCESS';
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => 'BillingAndPaymentTabController', 'methodName' => 'createPayment', 'exceptionObj' => e, 'moreDetails' =>  e.getMessage()});
            throw new AuraHandledException(e.getMessage());
        }
    }

    /*
    *********************************************************
    @description     : Approve Billing Record
    @param           : {String} billingId - Billing Record Id
    @return          : String - SUCCESS
    ********************************************************
    */
    @AuraEnabled
    public static String approveBilling(Id billingId){
        try {
            Billing__c billing = [SELECT Id, Status__c FROM Billing__c WHERE Id = :billingId LIMIT 1];

            if (billing.Status__c != 'Approved') {
                billing.Status__c = 'Approved';
                update billing;
            }
            return 'SUCCESS';
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => 'BillingAndPaymentTabController', 'methodName' => 'approveBilling', 'exceptionObj' => e, 'moreDetails' =>  e.getMessage()});
            throw new AuraHandledException(e.getMessage());
        }
    }

    /*
    *********************************************************
    @description     : Delete Record
    @param           : {Id} recordId - Record Id to delete
    @param           : {String} sObjectApiName - API Name of the sObject
    @return          : String - SUCCESS
    ********************************************************
    */
    @AuraEnabled
    public static String deleteRecord(Id recordId, String sObjectApiName){
        try {
            // Allow only specific objects
            Set<String> allowed = new Set<String>{ 'Billing__c', 'Payment__c' };
            if (!allowed.contains(sObjectApiName)) {
                throw new AuraHandledException('Unsupported object type for deletion.');
            }
            // Construct a stub sObject with Id and delete
            Type t = Type.forName('Schema.' + sObjectApiName);
            if (t == null) {
                throw new AuraHandledException('Invalid sObject API Name.');
            }
            SObject sobj = (SObject) t.newInstance();
            sobj.put('Id', recordId);
            Database.delete(sobj, false);
            return 'SUCCESS';
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => 'BillingAndPaymentTabController', 'methodName' => 'deleteRecord', 'exceptionObj' => e, 'moreDetails' =>  e.getMessage()});
            throw new AuraHandledException(e.getMessage());
        }
    }

    public class BillingResponse {
        @AuraEnabled public Boolean hasApprovedScopeEntries;
        @AuraEnabled public String message;
        @AuraEnabled public List<Billing__c> billings;
    }

    public class PaymentResponse {
        @AuraEnabled public Boolean hasApprovedBillings;
        @AuraEnabled public String message;
        @AuraEnabled public List<Payment__c> payments;
        @AuraEnabled public List<Billing__c> approvedBillings;
    }
}