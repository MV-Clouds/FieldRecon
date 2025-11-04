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
            return new List<Job__c>();
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
                SELECT Id, Name, Status__c, Job__r.Job_Name__c, Job__r.Retainage__c, Previous_Bill__c, Previous_Bill__r.Name, Retainage_Completed_to_Date__c,
                       Start_Date__c, End_Date__c, Sent_Date__c, Billing_Reference_Number__c, Bill_Type__c, Current_Payment_Due_FM__c
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
            return null;
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
            return null;
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

            // 2. Determine retainage, previous bill details and approved scope entries
            Decimal billRetainage = job.Retainage__c != null ? job.Retainage__c : 0.00;
            Boolean isRetainageBill = (billingType != null && billingType.equalsIgnoreCase('Retainage Bill'));

            Map<Id, Billing_Line_Item__c> prevBillItemMap = new Map<Id, Billing_Line_Item__c>();
            List<Billing_Line_Item__c> previousBillItems = new List<Billing_Line_Item__c>();

            if (String.isNotBlank(prevBill)) {
                Billing__c previousBilling = [
                    SELECT Id, Retainage_on_Bill__c
                    FROM Billing__c
                    WHERE Id = :prevBill
                    LIMIT 1
                ];
                if (previousBilling.Retainage_on_Bill__c != null) {
                    billRetainage = previousBilling.Retainage_on_Bill__c != null ? previousBilling.Retainage_on_Bill__c : 0.00;
                }

                previousBillItems = [
                    SELECT Id, Scope_Entry__c, Total_Complete_Percent__c, This_Billing_Percent__c, Remaining_Billing_Amount__c,
                           Total_Retainage_Amount__c, Total_Billed_Value__c, Retainage_Percent_on_Bill_Line_Item__c
                    FROM Billing_Line_Item__c
                    WHERE Billing__c = :prevBill
                ];

                for (Billing_Line_Item__c prevItem : previousBillItems) {
                    if (prevItem.Scope_Entry__c != null) {
                        prevBillItemMap.put(prevItem.Scope_Entry__c, prevItem);
                    }
                }
            }

            List<Scope_Entry__c> scopeEntries = [
                SELECT Id, Name, Contract_Value__c, Type__c, Scope_Entry_Status__c, Job__c, Completed_Percentage__c, Current_Complete_Value__c 
                FROM Scope_Entry__c 
                WHERE Job__c = :jobId AND Scope_Entry_Status__c = 'Approved'
                WITH USER_MODE
            ];

            Decimal hundred = 100;
            Boolean hasScopedLines = false;
            Boolean allPrevItemsComplete = true;
            for (Billing_Line_Item__c prevItem : previousBillItems) {
                if (prevItem.Scope_Entry__c == null) {
                    continue;
                }
                hasScopedLines = true;
                Decimal percent = prevItem.This_Billing_Percent__c;
                if (percent == null || percent != 100) {
                    allPrevItemsComplete = false;
                }
            }

            Set<Id> currentScopeEntryIds = new Set<Id>();
            for (Scope_Entry__c se : scopeEntries) {
                currentScopeEntryIds.add(se.Id);
            }

            Boolean hasNewScopeEntries = false;
            Boolean hasMissingScopeEntries = false;
            Boolean scopeEntriesMatch = true;

            if (String.isNotBlank(prevBill)) {
                Set<Id> prevScopeEntryIds = new Set<Id>(prevBillItemMap.keySet());

                Set<Id> newScopeEntries = currentScopeEntryIds.clone();
                newScopeEntries.removeAll(prevScopeEntryIds);
                hasNewScopeEntries = !newScopeEntries.isEmpty();

                Set<Id> missingScopeEntries = prevScopeEntryIds.clone();
                missingScopeEntries.removeAll(currentScopeEntryIds);
                hasMissingScopeEntries = !missingScopeEntries.isEmpty();

                scopeEntriesMatch = !hasNewScopeEntries && !hasMissingScopeEntries;
            }

            if (isRetainageBill) {
                if (String.isBlank(prevBill)) {
                    return 'Select a previous approved billing before creating a retainage bill.';
                }

                if (!hasScopedLines) {
                    return 'Retainage bill can only be created when the selected previous billing has scope line items.';
                }

                if (!allPrevItemsComplete) {
                    return 'Retainage bill can only be created when all previous billing line items are 100% complete.';
                }

                if (hasNewScopeEntries) {
                    return 'Retainage bill can only be created when no new scope entries have been added since the previous billing.';
                }

                if (hasMissingScopeEntries) {
                    return 'Retainage bill can only be created when scope entries match the previous billing.';
                }
            } else if (String.isNotBlank(prevBill)) {
                if (hasScopedLines && allPrevItemsComplete && scopeEntriesMatch) {
                    return 'Previous billing is fully complete with no new approved scope entries. Please create a retainage bill instead of a regular bill.';
                }
            }

            // 3. Create new Billing record
            Billing__c newBilling = new Billing__c();
            newBilling.Job__c = jobId;
            newBilling.Account__c = job.Account__c;
            newBilling.Status__c = 'Draft';
            newBilling.Bill_Type__c = isRetainageBill ? 'Retainage' : 'Regular';
            newBilling.Retainage_on_Bill__c = billRetainage;
            newBilling.Start_Date__c = startDate;
            newBilling.End_Date__c = endDate;
            if (String.isNotBlank(prevBill)) {
                newBilling.Previous_Bill__c = prevBill;
            }
            insert newBilling;

            // 4. Create Billing Line Items
            List<Billing_Line_Item__c> billLinesToInsert = new List<Billing_Line_Item__c>();
            for (Scope_Entry__c se : scopeEntries) {
                Billing_Line_Item__c newItem = new Billing_Line_Item__c();
                newItem.Billing__c = newBilling.Id;
                newItem.Bill_Item_Type__c = isRetainageBill ? 'Retainage' : 'Regular';
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
                    newItem.Previous_Bill_Line_Item__c = prevItem.Id;

                    Decimal prevCompletePercent = prevItem.This_Billing_Percent__c != null ? prevItem.This_Billing_Percent__c : 0;
                    Decimal currentCompletePercent = se.Completed_Percentage__c != null ? se.Completed_Percentage__c : 0;
                    Decimal appliedPercent = prevCompletePercent > currentCompletePercent ? prevCompletePercent : currentCompletePercent;
                    newItem.This_Billing_Percent__c = appliedPercent;

                    Decimal contractValue = se.Contract_Value__c != null ? se.Contract_Value__c : 0;
                    Decimal previousTotalBilled = prevItem.Total_Billed_Value__c != null ? prevItem.Total_Billed_Value__c : 0;
                    Decimal previousTotalRetainage = prevItem.Total_Retainage_Amount__c != null ? prevItem.Total_Retainage_Amount__c : 0;

                    previousTotalBilled = previousTotalBilled.setScale(2, System.RoundingMode.HALF_UP);
                    previousTotalRetainage = previousTotalRetainage.setScale(2, System.RoundingMode.HALF_UP);

                    Decimal grossToDate = (contractValue * appliedPercent) / 100;
                    Decimal previousGross = previousTotalBilled + previousTotalRetainage;
                    Decimal grossContribution = grossToDate - previousGross;
                    if (grossContribution < 0) {
                        grossContribution = 0;
                    }

                    Decimal factor = 1 + (lineRetainagePercent / 100);
                    Decimal thisBillingAmount = factor != 0 ? grossContribution / factor : grossContribution;
                    Decimal thisRetainageAmount = (thisBillingAmount * lineRetainagePercent) / 100;

                    Decimal totalRetainageAmount = previousTotalRetainage + thisRetainageAmount;
                    Decimal totalBilledAmount = previousTotalBilled + thisBillingAmount;

                    thisBillingAmount = thisBillingAmount.setScale(2, System.RoundingMode.HALF_UP);
                    thisRetainageAmount = thisRetainageAmount.setScale(2, System.RoundingMode.HALF_UP);
                    totalRetainageAmount = totalRetainageAmount.setScale(2, System.RoundingMode.HALF_UP);
                    totalBilledAmount = totalBilledAmount.setScale(2, System.RoundingMode.HALF_UP);

                    newItem.This_Billing_Value__c = thisBillingAmount;
                    newItem.This_Retainage_Amount__c = thisRetainageAmount;
                    newItem.Total_Retainage_Amount__c = totalRetainageAmount;
                    newItem.Total_Billed_Value__c = totalBilledAmount;
                    newItem.Previous_Billed_Value__c = previousTotalBilled;

                } else {
                    Decimal appliedPercent = se.Completed_Percentage__c != null ? se.Completed_Percentage__c : 0;
                    newItem.This_Billing_Percent__c = appliedPercent;

                    Decimal contractValue = se.Contract_Value__c != null ? se.Contract_Value__c : 0;
                    Decimal grossToDate = (contractValue * appliedPercent) / 100;
                    Decimal factor = 1 + (lineRetainagePercent / 100);
                    Decimal thisBillingAmount = factor != 0 ? grossToDate / factor : grossToDate;
                    Decimal thisRetainageAmount = (thisBillingAmount * lineRetainagePercent) / 100;

                    thisBillingAmount = thisBillingAmount.setScale(2, System.RoundingMode.HALF_UP);
                    thisRetainageAmount = thisRetainageAmount.setScale(2, System.RoundingMode.HALF_UP);

                    newItem.This_Billing_Value__c = thisBillingAmount;
                    newItem.This_Retainage_Amount__c = thisRetainageAmount;
                    newItem.Total_Retainage_Amount__c = thisRetainageAmount;
                    newItem.Total_Billed_Value__c = thisBillingAmount;
                    newItem.Previous_Billed_Value__c = 0;
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
            system.debug(e.getMessage());
            return e.getMessage();
        }
    }

    /*
    *********************************************************
    @description     : Create Payment Record
    @param           : {String} jobId - Job Record Id
    @param           : {String} billId - Billing Record Id
    @param           : {String} paymentReference - Payment Reference
    @param           : {Date} paymentReceivedDate - Payment Received Date
    @param           : {String} accountId - Account Id
    @return          : String - SUCCESS
    ********************************************************
    */
    @AuraEnabled
    public static string createPayment(String jobId, String billId, String paymentReference, Date paymentReceivedDate, String accountId){
        try {
            Payment__c p = new Payment__c();
            p.Job__c = jobId;
            p.Account__c = accountId;
            p.Billing__c = billId;
            p.Payment_Reference__c = paymentReference;
            p.Payment_Received_Date__c = paymentReceivedDate;
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
            return e.getMessage();
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
            return e.getMessage();
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
                return 'Invalid object type';
            }
            // Construct a stub sObject with Id and delete
            Type t = Type.forName('Schema.' + sObjectApiName);
            if (t == null) {
                return 'Object not found';
            }
            SObject sobj = (SObject) t.newInstance();
            sobj.put('Id', recordId);
            Database.delete(sobj, false);
            return 'SUCCESS';
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => 'BillingAndPaymentTabController', 'methodName' => 'deleteRecord', 'exceptionObj' => e, 'moreDetails' =>  e.getMessage()});
            return e.getMessage();
        }
    }

    /*
    *********************************************************
    @description     : Clone Billing Record with its Billing Line Items
    @param           : {Id} billingId - Billing Record Id to clone
    @return          : String - SUCCESS or error message
    ********************************************************
    */
    @AuraEnabled
    public static String cloneBilling(Id billingId){

        System.debug('billingId: ' + billingId);
        try {
            // Fetch the original billing record with all necessary fields
            Billing__c originalBilling = [
                SELECT Id, Job__c, Account__c, Status__c, Bill_Type__c, Retainage_on_Bill__c,
                       Start_Date__c, End_Date__c, Previous_Bill__c
                FROM Billing__c
                WHERE Id = :billingId
                WITH USER_MODE
                LIMIT 1
            ];

            // Create a new billing record (using manual approach to avoid issues with formula fields and relationships)
            Billing__c clonedBilling = new Billing__c();
            clonedBilling.Job__c = originalBilling.Job__c;
            clonedBilling.Account__c = originalBilling.Account__c;
            clonedBilling.Status__c = 'Draft'; // Always set to Draft for cloned records
            clonedBilling.Bill_Type__c = originalBilling.Bill_Type__c;
            clonedBilling.Retainage_on_Bill__c = originalBilling.Retainage_on_Bill__c;
            clonedBilling.Start_Date__c = originalBilling.Start_Date__c;
            clonedBilling.End_Date__c = originalBilling.End_Date__c;
            clonedBilling.Previous_Bill__c = originalBilling.Previous_Bill__c;
            
            insert clonedBilling;

            // Fetch all billing line items from the original billing
            List<Billing_Line_Item__c> originalLineItems = [
                SELECT Id, Scope_Entry__c, Bill_Item_Type__c, Scope_Contract_Amount__c,
                       Scope_Complete__c, Retainage_Percent_on_Bill_Line_Item__c,
                       Previous_Bill_Line_Item__c, This_Billing_Percent__c,
                       This_Retainage_Amount__c, Total_Retainage_Amount__c,
                       This_Billing_Value__c, Total_Billed_Value__c, Previous_Billed_Value__c
                FROM Billing_Line_Item__c
                WHERE Billing__c = :billingId
                WITH USER_MODE
            ];

            // Clone billing line items
            List<Billing_Line_Item__c> clonedLineItems = new List<Billing_Line_Item__c>();
            for (Billing_Line_Item__c originalItem : originalLineItems) {
                Billing_Line_Item__c clonedItem = new Billing_Line_Item__c();
                clonedItem.Billing__c = clonedBilling.Id;
                clonedItem.Scope_Entry__c = originalItem.Scope_Entry__c;
                clonedItem.Bill_Item_Type__c = originalItem.Bill_Item_Type__c;
                clonedItem.Scope_Contract_Amount__c = originalItem.Scope_Contract_Amount__c;
                clonedItem.Scope_Complete__c = originalItem.Scope_Complete__c;
                clonedItem.Retainage_Percent_on_Bill_Line_Item__c = originalItem.Retainage_Percent_on_Bill_Line_Item__c;
                clonedItem.Previous_Bill_Line_Item__c = originalItem.Previous_Bill_Line_Item__c;
                clonedItem.This_Billing_Percent__c = originalItem.This_Billing_Percent__c;
                clonedItem.This_Retainage_Amount__c = originalItem.This_Retainage_Amount__c;
                clonedItem.Total_Retainage_Amount__c = originalItem.Total_Retainage_Amount__c;
                clonedItem.This_Billing_Value__c = originalItem.This_Billing_Value__c;
                clonedItem.Total_Billed_Value__c = originalItem.Total_Billed_Value__c;
                clonedItem.Previous_Billed_Value__c = originalItem.Previous_Billed_Value__c;
                clonedLineItems.add(clonedItem);
            }

            if (!clonedLineItems.isEmpty()) {
                insert clonedLineItems;
            }

            return 'SUCCESS';
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{
                'className' => 'BillingAndPaymentTabController', 
                'methodName' => 'cloneBilling', 
                'exceptionObj' => e, 
                'moreDetails' => e.getMessage()
            });
            return e.getMessage();
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