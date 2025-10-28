public with sharing class BillingDetailsPageController {

    @AuraEnabled
    public static BillDataWrapper getBillingsData(String billingId) {
        try {
            BillDataWrapper wrapper = new BillDataWrapper();

            // Query Billing record
            wfrecon__Billing__c bill = [
                SELECT Id, Name, wfrecon__Job__c, wfrecon__Job__r.wfrecon__Retainage__c, wfrecon__Retainage_on_Bill__c, wfrecon__Job__r.wfrecon__Total_Contract_Price__c, wfrecon__Job__r.wfrecon__Total_Change_Order_Value__c, 
                       wfrecon__Contract_Sum_to_Date__c, Total_Billed_Amount__c, wfrecon__Total_Amount_Earned_Less_Retainage__c, Current_Payment_Due_FM__c, Bill_Type__c, Account__c, wfrecon__Account__r.BillingStreet, wfrecon__Account__r.BillingCity,
                       wfrecon__Account__r.BillingState, wfrecon__Account__r.BillingPostalCode, wfrecon__Balance_to_Finish_Retainage__c, wfrecon__Account__r.Name, wfrecon__Application_Number__c, wfrecon__Billing_Reference_Number__c,
                       wfrecon__Is_Retainage_Billing__c, wfrecon__Previous_Bill__c, wfrecon__Previous_Bill__r.Name, wfrecon__Previous_Billed_Amount__c, wfrecon__Sent_Date__c, wfrecon__Start_Date__c, wfrecon__End_Date__c, wfrecon__Status__c,
                       wfrecon__Job__r.Name, wfrecon__Job__r.wfrecon__Job_Name__c, wfrecon__Job__r.wfrecon__Account__r.Name, wfrecon__Payment_Due_Date__c, Retainage_Completed_to_Date__c, Less_Previous_Certificated_for_Payment__c
                FROM wfrecon__Billing__c
                WHERE Id = :billingId
                WITH USER_MODE
                LIMIT 1
            ];

            // Populate Billing details in wrapper with null checks and default values
            wrapper.billDetails = new BillWrapper();
            wrapper.billDetails.Id = bill.Id;
            wrapper.billDetails.Name = String.isNotBlank(bill.Name) ? bill.Name : '-';
            wrapper.billDetails.BillType = String.isNotBlank(bill.Bill_Type__c) ? bill.Bill_Type__c : 'Regular';
            wrapper.billDetails.BillingReferenceNumber = String.isNotBlank(bill.wfrecon__Billing_Reference_Number__c) ? bill.wfrecon__Billing_Reference_Number__c : '-';
            wrapper.billDetails.ApplicationNumber = String.isNotBlank(bill.wfrecon__Application_Number__c) ? bill.wfrecon__Application_Number__c : '-';
            wrapper.billDetails.Status = String.isNotBlank(bill.wfrecon__Status__c) ? bill.wfrecon__Status__c : '-';
            wrapper.billDetails.StartDate = bill.wfrecon__Start_Date__c;
            wrapper.billDetails.EndDate = bill.wfrecon__End_Date__c;
            wrapper.billDetails.SentDate = bill.wfrecon__Sent_Date__c;
            wrapper.billDetails.Address = buildAddress(bill.wfrecon__Account__r);
            wrapper.billDetails.AccountName = (bill.wfrecon__Account__r != null && String.isNotBlank(bill.wfrecon__Account__r.Name)) ? bill.wfrecon__Account__r.Name : '-';
            wrapper.billDetails.RetainageOnBill = bill.wfrecon__Retainage_on_Bill__c != null ? bill.wfrecon__Retainage_on_Bill__c : 0.00;
            wrapper.billDetails.TotalEarnedLessRetainage = bill.wfrecon__Total_Amount_Earned_Less_Retainage__c != null ? bill.wfrecon__Total_Amount_Earned_Less_Retainage__c : 0.00;
            wrapper.billDetails.TotalCompletedAndStoredToDate = bill.Total_Billed_Amount__c != null ? bill.Total_Billed_Amount__c : 0.00;
            wrapper.billDetails.LessPreviousCertificatedforPayment = bill.Less_Previous_Certificated_for_Payment__c != null ? bill.Less_Previous_Certificated_for_Payment__c : 0.00;
            wrapper.billDetails.CurrentPaymentDue = bill.Current_Payment_Due_FM__c != null ? bill.Current_Payment_Due_FM__c : 0.00;
            wrapper.billDetails.ContractSumToDate = bill.wfrecon__Contract_Sum_to_Date__c != null ? bill.wfrecon__Contract_Sum_to_Date__c : 0.00;
            wrapper.billDetails.BalanceToFinishRetainage = bill.wfrecon__Balance_to_Finish_Retainage__c != null ? bill.wfrecon__Balance_to_Finish_Retainage__c : 0.00;
            wrapper.billDetails.IsRetainageBilling = bill.wfrecon__Is_Retainage_Billing__c != null ? bill.wfrecon__Is_Retainage_Billing__c : false;
            wrapper.billDetails.PreviousBillId = bill.wfrecon__Previous_Bill__c;
            wrapper.billDetails.PreviousBillName = (bill.wfrecon__Previous_Bill__r != null && String.isNotBlank(bill.wfrecon__Previous_Bill__r.Name)) ? bill.wfrecon__Previous_Bill__r.Name : '-';
            wrapper.billDetails.RetainageCompletedToDate = bill.Retainage_Completed_to_Date__c != null ? bill.Retainage_Completed_to_Date__c : 0.00;
            wrapper.billDetails.PreviousBilledAmount = bill.wfrecon__Previous_Billed_Amount__c != null ? bill.wfrecon__Previous_Billed_Amount__c : 0.00;
            wrapper.billDetails.jobRetainage = bill.wfrecon__Job__r.wfrecon__Retainage__c != null ? bill.wfrecon__Job__r.wfrecon__Retainage__c : 0.00;
            wrapper.billDetails.jobTotalContractPrice = bill.wfrecon__Job__r.wfrecon__Total_Contract_Price__c != null ? bill.wfrecon__Job__r.wfrecon__Total_Contract_Price__c : 0.00;
            wrapper.billDetails.jobTotalChangeOrderValue = bill.wfrecon__Job__r.wfrecon__Total_Change_Order_Value__c != null ? bill.wfrecon__Job__r.wfrecon__Total_Change_Order_Value__c : 0.00;
            wrapper.billDetails.JobId = bill.wfrecon__Job__c;
            wrapper.billDetails.JobName = String.isNotBlank(bill.wfrecon__Job__r.wfrecon__Job_Name__c) ? bill.wfrecon__Job__r.wfrecon__Job_Name__c : '-';
            wrapper.billDetails.JobNumber = String.isNotBlank(bill.wfrecon__Job__r.Name) ? bill.wfrecon__Job__r.Name : '-';
            wrapper.billDetails.PaymentDueDate = bill.wfrecon__Payment_Due_Date__c;

            // Query Billing Line Items directly
            List<wfrecon__Billing_Line_Item__c> billLineItems = [
                SELECT Id, wfrecon__Billing__c, wfrecon__Scope_Entry__c, wfrecon__Scope_Entry__r.Name, wfrecon__Scope_Entry_Type__c, wfrecon__Scope_Contract_Amount__c,
                       Previous_Billed_Value__c, Previous_Billed_Percent__c, wfrecon__This_Billing_Percent__c, wfrecon__Total_Retainage_Amount__c,
                       Scope_Complete__c, wfrecon__Total_Billing_Value_Retainage__c, This_Billing_Value__c,
                       wfrecon__Due_This_Billing__c, wfrecon__Retainage_Percent_on_Bill_Line_Item__c,
                       wfrecon__This_Retainage_Amount__c
                FROM wfrecon__Billing_Line_Item__c
                WHERE wfrecon__Billing__c = :billingId
            ];

            Decimal totalDueThisBilling = 0; 
            for(wfrecon__Billing_Line_Item__c bli : billLineItems) { 
                totalDueThisBilling += bli.wfrecon__Due_This_Billing__c;
            }

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
            
            // Track retainage change to cascade updates to line items
            Boolean retainageChanged = false;
            Decimal updatedRetainageOnBill;

            // Update fields based on the map values
            if (fieldValues.containsKey('Status')) {
                billing.wfrecon__Status__c = (String) fieldValues.get('Status');
            }
            if (fieldValues.containsKey('RetainageOnBill')) {
                updatedRetainageOnBill = (Decimal) fieldValues.get('RetainageOnBill');
                billing.wfrecon__Retainage_on_Bill__c = updatedRetainageOnBill;
                retainageChanged = true;
            }
            if (fieldValues.containsKey('SentDate')) {
                billing.wfrecon__Sent_Date__c = Date.valueOf((String) fieldValues.get('SentDate'));
            }
            if (fieldValues.containsKey('BillingReferenceNumber')) {
                billing.wfrecon__Billing_Reference_Number__c = (String) fieldValues.get('BillingReferenceNumber');
            }
            if (fieldValues.containsKey('ApplicationNumber')) {
                billing.wfrecon__Application_Number__c = (String) fieldValues.get('ApplicationNumber');
            }
            if (fieldValues.containsKey('StartDate')) {
                billing.wfrecon__Start_Date__c = Date.valueOf((String) fieldValues.get('StartDate'));
            }
            if (fieldValues.containsKey('EndDate')) {
                billing.wfrecon__End_Date__c = Date.valueOf((String) fieldValues.get('EndDate'));
            }
            if (fieldValues.containsKey('PaymentDueDate')) {
                billing.wfrecon__Payment_Due_Date__c = Date.valueOf((String) fieldValues.get('PaymentDueDate'));
            }
            
            update billing;

            if (retainageChanged) {
                Decimal retainageValueToApply = updatedRetainageOnBill != null ? updatedRetainageOnBill : 0;

                List<wfrecon__Billing_Line_Item__c> relatedLineItems = [
                    SELECT Id
                    FROM wfrecon__Billing_Line_Item__c
                    WHERE wfrecon__Billing__c = :billingId
                ];

                if (!relatedLineItems.isEmpty()) {
                    List<Map<String, Object>> retainageUpdates = new List<Map<String, Object>>();
                    for (wfrecon__Billing_Line_Item__c lineItem : relatedLineItems) {
                        retainageUpdates.add(new Map<String, Object>{
                            'Id' => lineItem.Id,
                            'wfrecon__Retainage_Percent_on_Bill_Line_Item__c' => retainageValueToApply
                        });
                    }

                    saveBillingLineItems(billingId, retainageUpdates);
                }
            }
            
            return 'SUCCESS';
        } catch (Exception e) {
            System.debug('Error updating billing details: ' + e.getMessage());
            throw new AuraHandledException(e.getMessage());
        }
    }

    @AuraEnabled
    public static String saveBillingLineItems(String billingId, List<Map<String, Object>> lineItemUpdates) {
        try {
            // Collect record Ids from updates
            Set<Id> recordIds = new Set<Id>();
            Map<Id, Map<String, Object>> updateMap = new Map<Id, Map<String, Object>>();
            
            for (Map<String, Object> line : lineItemUpdates) {
                if (line.containsKey('Id')) {
                    Id recordId = (Id) line.get('Id');
                    recordIds.add(recordId);
                    updateMap.put(recordId, line);
                }
            }

            if (recordIds.isEmpty()) {
                return 'No records to update';
            }

            // Query existing Billing Line Items with all necessary fields for calculations
            List<wfrecon__Billing_Line_Item__c> lineItems = [
                SELECT Id,
                       wfrecon__Scope_Contract_Amount__c,
                       wfrecon__This_Retainage_Amount__c,
                       wfrecon__This_Billing_Percent__c,
                       wfrecon__Retainage_Percent_on_Bill_Line_Item__c,
                       wfrecon__Previous_Billed_Value__c,
                       wfrecon__Total_Billed_Value__c,
                       wfrecon__Total_Retainage_Amount__c,
                       wfrecon__This_Billing_Value__c,
                       wfrecon__Due_This_Billing__c,
                       wfrecon__Previous_Bill_Line_Item__c,
                       wfrecon__Remaining_Billing_Amount__c,
                       wfrecon__Billing__r.wfrecon__Job__r.wfrecon__Retainage__c,
                       wfrecon__Scope_Entry__r.wfrecon__Contract_Value__c
                FROM wfrecon__Billing_Line_Item__c
                WHERE Id IN :recordIds
            ];

            Set<Id> previousItemIds = new Set<Id>();
            for (wfrecon__Billing_Line_Item__c item : lineItems) {
                if (item.wfrecon__Previous_Bill_Line_Item__c != null) {
                    previousItemIds.add(item.wfrecon__Previous_Bill_Line_Item__c);
                }
            }

            Map<Id, wfrecon__Billing_Line_Item__c> previousItemsMap = new Map<Id, wfrecon__Billing_Line_Item__c>();
            if (!previousItemIds.isEmpty()) {
                previousItemsMap = new Map<Id, wfrecon__Billing_Line_Item__c>([
                    SELECT Id,
                           wfrecon__Total_Billed_Value__c,
                           wfrecon__Total_Retainage_Amount__c,
                           wfrecon__Remaining_Billing_Amount__c
                    FROM wfrecon__Billing_Line_Item__c
                    WHERE Id IN :previousItemIds
                ]);
            }

            List<wfrecon__Billing_Line_Item__c> itemsToUpdate = new List<wfrecon__Billing_Line_Item__c>();

            for (wfrecon__Billing_Line_Item__c item : lineItems) {
                Map<String, Object> updates = updateMap.get(item.Id);
                if (updates == null || updates.isEmpty()) {
                    continue;
                }

                Decimal contractAmount = item.wfrecon__Scope_Contract_Amount__c != null ? item.wfrecon__Scope_Contract_Amount__c : 0;
                if (contractAmount == 0 && item.wfrecon__Scope_Entry__r?.wfrecon__Contract_Value__c != null) {
                    contractAmount = item.wfrecon__Scope_Entry__r.wfrecon__Contract_Value__c;
                }
                Decimal jobRetainagePercent = item.wfrecon__Billing__r?.wfrecon__Job__r?.wfrecon__Retainage__c != null
                    ? item.wfrecon__Billing__r.wfrecon__Job__r.wfrecon__Retainage__c
                    : 0;

                Decimal updatedBillingPercent = item.wfrecon__This_Billing_Percent__c != null ? item.wfrecon__This_Billing_Percent__c : 0;
                Decimal updatedRetainagePercent = item.wfrecon__Retainage_Percent_on_Bill_Line_Item__c != null
                    ? item.wfrecon__Retainage_Percent_on_Bill_Line_Item__c
                    : jobRetainagePercent;

                Boolean billingPercentProvided = false;
                if (updates.containsKey('wfrecon__This_Billing_Percent__c')) {
                    Decimal providedBillingPercent = (Decimal) updates.get('wfrecon__This_Billing_Percent__c');
                    if (providedBillingPercent != null) {
                        updatedBillingPercent = providedBillingPercent;
                        billingPercentProvided = true;
                    }
                }

                Boolean retainagePercentProvided = false;
                if (updates.containsKey('wfrecon__Retainage_Percent_on_Bill_Line_Item__c')) {
                    Decimal providedRetainagePercent = (Decimal) updates.get('wfrecon__Retainage_Percent_on_Bill_Line_Item__c');
                    if (providedRetainagePercent != null) {
                        updatedRetainagePercent = providedRetainagePercent;
                        retainagePercentProvided = true;
                    }
                }

                if (!billingPercentProvided && !retainagePercentProvided) {
                    continue;
                }

                Decimal previousTotalBilled = item.wfrecon__Previous_Billed_Value__c != null ? item.wfrecon__Previous_Billed_Value__c : 0;
                Decimal previousTotalRetainage = 0;
                Decimal previousRemainingAmount = 0;

                if (item.wfrecon__Previous_Bill_Line_Item__c != null && previousItemsMap.containsKey(item.wfrecon__Previous_Bill_Line_Item__c)) {
                    wfrecon__Billing_Line_Item__c prevItem = previousItemsMap.get(item.wfrecon__Previous_Bill_Line_Item__c);
                    if (prevItem != null) {
                        if (prevItem.wfrecon__Total_Billed_Value__c != null) {
                            previousTotalBilled = prevItem.wfrecon__Total_Billed_Value__c;
                        }
                        if (prevItem.wfrecon__Total_Retainage_Amount__c != null) {
                            previousTotalRetainage = prevItem.wfrecon__Total_Retainage_Amount__c;
                        }
                        if (prevItem.wfrecon__Remaining_Billing_Amount__c != null) {
                            previousRemainingAmount = prevItem.wfrecon__Remaining_Billing_Amount__c;
                        }
                    }
                } else {
                    previousRemainingAmount = contractAmount;
                }

                if (previousTotalRetainage == 0 && item.wfrecon__Total_Retainage_Amount__c != null) {
                    Decimal currentRetainage = item.wfrecon__This_Retainage_Amount__c != null ? item.wfrecon__This_Retainage_Amount__c : 0;
                    Decimal inferredPreviousRetainage = item.wfrecon__Total_Retainage_Amount__c - currentRetainage;
                    if (inferredPreviousRetainage > 0) {
                        previousTotalRetainage = inferredPreviousRetainage;
                    }
                }

                // if (previousRemainingAmount == 0 && item.wfrecon__Remaining_Billing_Amount__c != null) {
                //     previousRemainingAmount = item.wfrecon__Remaining_Billing_Amount__c;
                // }

                // if (previousRemainingAmount == 0) {
                //     // Fallback to contract less previous billed amount when remaining is not available
                //     previousRemainingAmount = contractAmount - previousTotalBilled;
                // }
                // if (previousRemainingAmount < 0) {
                //     previousRemainingAmount = 0;
                // }

                Decimal grossBillingAmount = (contractAmount * updatedBillingPercent) / 100;
                Decimal retainageAmount = (previousRemainingAmount * updatedRetainagePercent) / 100;
                Decimal totalRetainageAmount = previousTotalRetainage + retainageAmount;
                Decimal thisBillingValue = grossBillingAmount - totalRetainageAmount - previousTotalBilled;
                Decimal totalBilledValue = previousTotalBilled + thisBillingValue;

                item.wfrecon__This_Billing_Percent__c = updatedBillingPercent;
                item.wfrecon__Retainage_Percent_on_Bill_Line_Item__c = updatedRetainagePercent;
                item.wfrecon__This_Retainage_Amount__c = retainageAmount;
                item.wfrecon__Total_Retainage_Amount__c = totalRetainageAmount;
                item.wfrecon__This_Billing_Value__c = thisBillingValue;
                item.wfrecon__Total_Billed_Value__c = totalBilledValue;
                // item.wfrecon__Due_This_Billing__c = thisBillingValue;

                itemsToUpdate.add(item);
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

    private static String buildAddress(Account acc) {
        if (acc == null) return '-';
        
        List<String> addressParts = new List<String>();
        
        if (String.isNotBlank(acc.BillingStreet)) {
            addressParts.add(acc.BillingStreet);
        }
        if (String.isNotBlank(acc.BillingCity)) {
            addressParts.add(acc.BillingCity);
        }
        if (String.isNotBlank(acc.BillingState)) {
            addressParts.add(acc.BillingState);
        }
        if (String.isNotBlank(acc.BillingPostalCode)) {
            addressParts.add(acc.BillingPostalCode);
        }
        
        return !addressParts.isEmpty() ? String.join(addressParts, ', ') : '-';
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
        @AuraEnabled public String BillType;
        @AuraEnabled public String Address;
        @AuraEnabled public String PreviousBillName;
        @AuraEnabled public String BillingReferenceNumber;
        @AuraEnabled public String ApplicationNumber;
        @AuraEnabled public String Status;
        @AuraEnabled public Date StartDate;
        @AuraEnabled public Date EndDate;
        @AuraEnabled public Date SentDate;
        @AuraEnabled public String AccountName;
        @AuraEnabled public Decimal RetainageOnBill;
        @AuraEnabled public Decimal TotalEarnedLessRetainage;
        @AuraEnabled public Decimal TotalCompletedAndStoredToDate;
        @AuraEnabled public Decimal LessPreviousCertificatedforPayment;
        @AuraEnabled public Decimal CurrentPaymentDue;
        @AuraEnabled public Decimal RetainageCompletedToDate;
        @AuraEnabled public Decimal TotalDueThisBilling;
        @AuraEnabled public Decimal BalanceToFinishRetainage;
        @AuraEnabled public Decimal ContractSumToDate;
        @AuraEnabled public Boolean IsRetainageBilling;
        @AuraEnabled public Id PreviousBillId;
        @AuraEnabled public Decimal PreviousBilledAmount;
        @AuraEnabled public Decimal jobRetainage;
        @AuraEnabled public Decimal jobTotalContractPrice;
        @AuraEnabled public Decimal jobTotalChangeOrderValue;
        @AuraEnabled public String JobId;
        @AuraEnabled public String JobName;
        @AuraEnabled public String JobNumber;
        @AuraEnabled public Date PaymentDueDate;

        public BillWrapper() {}
    }
}