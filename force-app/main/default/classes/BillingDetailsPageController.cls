public with sharing class BillingDetailsPageController {

    @AuraEnabled
    public static BillDataWrapper getBillingsData(String billingId) {
        try {
            BillDataWrapper wrapper = new BillDataWrapper();

            // Query Billing record
            wfrecon__Billing__c bill = [
                SELECT Id, Name, wfrecon__Job__c, wfrecon__Job__r.wfrecon__Retainage__c, wfrecon__Retainage_on_Bill__c, wfrecon__Job__r.wfrecon__Total_Contract_Value__c, wfrecon__Job__r.wfrecon__Total_Change_Order_Value__c, 
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
            wrapper.billDetails.Name = String.isNotBlank(bill.Name) ? bill.Name : '--';
            wrapper.billDetails.BillType = String.isNotBlank(bill.Bill_Type__c) ? bill.Bill_Type__c : 'Regular';
            wrapper.billDetails.BillingReferenceNumber = String.isNotBlank(bill.wfrecon__Billing_Reference_Number__c) ? bill.wfrecon__Billing_Reference_Number__c : '--';
            wrapper.billDetails.ApplicationNumber = String.isNotBlank(bill.wfrecon__Application_Number__c) ? bill.wfrecon__Application_Number__c : '--';
            wrapper.billDetails.Status = String.isNotBlank(bill.wfrecon__Status__c) ? bill.wfrecon__Status__c : '--';
            wrapper.billDetails.StartDate = bill.wfrecon__Start_Date__c;
            wrapper.billDetails.EndDate = bill.wfrecon__End_Date__c;
            wrapper.billDetails.SentDate = bill.wfrecon__Sent_Date__c;
            wrapper.billDetails.Address = buildAddress(bill.wfrecon__Account__r);
            wrapper.billDetails.AccountName = (bill.wfrecon__Account__r != null && String.isNotBlank(bill.wfrecon__Account__r.Name)) ? bill.wfrecon__Account__r.Name : '--';
            wrapper.billDetails.RetainageOnBill = bill.wfrecon__Retainage_on_Bill__c != null ? bill.wfrecon__Retainage_on_Bill__c : 0.00;
            wrapper.billDetails.TotalEarnedLessRetainage = bill.wfrecon__Total_Amount_Earned_Less_Retainage__c != null ? bill.wfrecon__Total_Amount_Earned_Less_Retainage__c : 0.00;
            wrapper.billDetails.TotalCompletedAndStoredToDate = bill.Total_Billed_Amount__c != null ? bill.Total_Billed_Amount__c : 0.00;
            wrapper.billDetails.LessPreviousCertificatedforPayment = bill.Less_Previous_Certificated_for_Payment__c != null ? bill.Less_Previous_Certificated_for_Payment__c : 0.00;
            wrapper.billDetails.CurrentPaymentDue = bill.Current_Payment_Due_FM__c != null ? bill.Current_Payment_Due_FM__c : 0.00;
            wrapper.billDetails.ContractSumToDate = bill.wfrecon__Contract_Sum_to_Date__c != null ? bill.wfrecon__Contract_Sum_to_Date__c : 0.00;
            wrapper.billDetails.BalanceToFinishRetainage = bill.wfrecon__Balance_to_Finish_Retainage__c != null ? bill.wfrecon__Balance_to_Finish_Retainage__c : 0.00;
            wrapper.billDetails.IsRetainageBilling = bill.wfrecon__Is_Retainage_Billing__c != null ? bill.wfrecon__Is_Retainage_Billing__c : false;
            wrapper.billDetails.PreviousBillId = bill.wfrecon__Previous_Bill__c;
            wrapper.billDetails.PreviousBillName = (bill.wfrecon__Previous_Bill__r != null && String.isNotBlank(bill.wfrecon__Previous_Bill__r.Name)) ? bill.wfrecon__Previous_Bill__r.Name : '--';
            wrapper.billDetails.RetainageCompletedToDate = bill.Retainage_Completed_to_Date__c != null ? bill.Retainage_Completed_to_Date__c : 0.00;
            wrapper.billDetails.PreviousBilledAmount = bill.wfrecon__Previous_Billed_Amount__c != null ? bill.wfrecon__Previous_Billed_Amount__c : 0.00;
            wrapper.billDetails.jobRetainage = bill.wfrecon__Job__r.wfrecon__Retainage__c != null ? bill.wfrecon__Job__r.wfrecon__Retainage__c : 0.00;
            wrapper.billDetails.jobTotalContractPrice = bill.wfrecon__Job__r.wfrecon__Total_Contract_Value__c != null ? bill.wfrecon__Job__r.wfrecon__Total_Contract_Value__c : 0.00;
            wrapper.billDetails.jobTotalChangeOrderValue = bill.wfrecon__Job__r.wfrecon__Total_Change_Order_Value__c != null ? bill.wfrecon__Job__r.wfrecon__Total_Change_Order_Value__c : 0.00;
            wrapper.billDetails.JobId = bill.wfrecon__Job__c;
            wrapper.billDetails.JobName = String.isNotBlank(bill.wfrecon__Job__r.wfrecon__Job_Name__c) ? bill.wfrecon__Job__r.wfrecon__Job_Name__c : '--';
            wrapper.billDetails.JobNumber = String.isNotBlank(bill.wfrecon__Job__r.Name) ? bill.wfrecon__Job__r.Name : '--';
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
            ExceptionHandler.logException(new Map<String, Object>{'className' => 'BillingDetailsPageController', 'methodName' => 'getBillingsData', 'exceptionObj' => e, 'moreDetails' =>  e.getMessage()});
            System.debug('Error fetching billing data: ' + e.getMessage());
            return null;
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
            ExceptionHandler.logException(new Map<String, Object>{'className' => 'BillingDetailsPageController', 'methodName' => 'updateBillingDetails', 'exceptionObj' => e, 'moreDetails' =>  e.getMessage()});
            return null;
        }
    }

    @AuraEnabled
    public static Map<String, String> saveBillingLineItems(String billingId, List<Map<String, Object>> lineItemUpdates) {
        try {
            Map<String, String> result = new Map<String, String>();
            result.put('status', 'SUCCESS');
            result.put('message', 'Line item changes saved successfully.');
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
                result.put('status', 'ERROR');
                result.put('message', 'No records to update');
                return result;
            }

            // Query existing Billing Line Items with all necessary fields for calculations
            List<wfrecon__Billing_Line_Item__c> lineItems = [
                SELECT Id,
                       wfrecon__Scope_Contract_Amount__c,
                       wfrecon__This_Retainage_Amount__c,
                       wfrecon__This_Billing_Percent__c,
                       wfrecon__Retainage_Percent_on_Bill_Line_Item__c,
                       wfrecon__Previous_Billed_Value__c,
                       wfrecon__Previous_Billed_Percent__c,
                       wfrecon__Scope_Complete__c,
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
            Decimal tolerance = 0.0001;
            System.RoundingMode roundingMode = System.RoundingMode.HALF_UP;

            for (wfrecon__Billing_Line_Item__c item : lineItems) {
                Map<String, Object> updates = updateMap.get(item.Id);
                if (updates == null || updates.isEmpty()) {
                    continue;
                }

                Boolean hasAmountUpdate = updates.containsKey('wfrecon__This_Billing_Value__c');
                Boolean hasPercentUpdate = updates.containsKey('wfrecon__This_Billing_Percent__c');
                Boolean hasRetainageUpdate = updates.containsKey('wfrecon__Retainage_Percent_on_Bill_Line_Item__c');

                if (!hasAmountUpdate && !hasPercentUpdate && !hasRetainageUpdate) {
                    continue;
                }

                Decimal contractAmount = item.wfrecon__Scope_Contract_Amount__c != null ? item.wfrecon__Scope_Contract_Amount__c : 0;
                if (contractAmount == 0 && item.wfrecon__Scope_Entry__r != null && item.wfrecon__Scope_Entry__r.wfrecon__Contract_Value__c != null) {
                    contractAmount = item.wfrecon__Scope_Entry__r.wfrecon__Contract_Value__c;
                }

                Decimal baseRetainagePercent = item.wfrecon__Retainage_Percent_on_Bill_Line_Item__c != null
                    ? item.wfrecon__Retainage_Percent_on_Bill_Line_Item__c
                    : (item.wfrecon__Billing__r != null && item.wfrecon__Billing__r.wfrecon__Job__r != null && item.wfrecon__Billing__r.wfrecon__Job__r.wfrecon__Retainage__c != null
                        ? item.wfrecon__Billing__r.wfrecon__Job__r.wfrecon__Retainage__c
                        : 0);

                Decimal retainagePercent = baseRetainagePercent;
                if (hasRetainageUpdate && updates.get('wfrecon__Retainage_Percent_on_Bill_Line_Item__c') != null) {
                    retainagePercent = (Decimal) updates.get('wfrecon__Retainage_Percent_on_Bill_Line_Item__c');
                }

                if (retainagePercent < 0 || retainagePercent > 100) {
                    result.put('status', 'ERROR');
                    result.put('message', 'Retainage % must be between 0 and 100.');
                    return result;
                }

                Decimal thisBillingAmount = item.wfrecon__This_Billing_Value__c != null ? item.wfrecon__This_Billing_Value__c : 0;
                if (hasAmountUpdate && updates.get('wfrecon__This_Billing_Value__c') != null) {
                    thisBillingAmount = (Decimal) updates.get('wfrecon__This_Billing_Value__c');
                }

                Decimal thisBillingPercent = item.wfrecon__This_Billing_Percent__c != null ? item.wfrecon__This_Billing_Percent__c : 0;
                if (hasPercentUpdate && updates.get('wfrecon__This_Billing_Percent__c') != null) {
                    thisBillingPercent = (Decimal) updates.get('wfrecon__This_Billing_Percent__c');
                }

                Decimal previousTotalBilled = item.wfrecon__Previous_Billed_Value__c != null ? item.wfrecon__Previous_Billed_Value__c : 0;
                Decimal previousTotalRetainage = 0;

                if (item.wfrecon__Previous_Bill_Line_Item__c != null && previousItemsMap.containsKey(item.wfrecon__Previous_Bill_Line_Item__c)) {
                    wfrecon__Billing_Line_Item__c prevItem = previousItemsMap.get(item.wfrecon__Previous_Bill_Line_Item__c);
                    if (prevItem != null) {
                        if (prevItem.wfrecon__Total_Billed_Value__c != null) {
                            previousTotalBilled = prevItem.wfrecon__Total_Billed_Value__c;
                        }
                        if (prevItem.wfrecon__Total_Retainage_Amount__c != null) {
                            previousTotalRetainage = prevItem.wfrecon__Total_Retainage_Amount__c;
                        }
                    }
                } else {
                    Decimal currentRetainage = item.wfrecon__This_Retainage_Amount__c != null ? item.wfrecon__This_Retainage_Amount__c : 0;
                    Decimal totalRetainage = item.wfrecon__Total_Retainage_Amount__c != null ? item.wfrecon__Total_Retainage_Amount__c : 0;
                    Decimal inferredPreviousRetainage = totalRetainage - currentRetainage;
                    if (inferredPreviousRetainage > 0) {
                        previousTotalRetainage = inferredPreviousRetainage;
                    }
                }

                previousTotalBilled = previousTotalBilled.setScale(2, roundingMode);
                previousTotalRetainage = previousTotalRetainage.setScale(2, roundingMode);

                Decimal previousBilledPercent = item.wfrecon__Previous_Billed_Percent__c != null ? item.wfrecon__Previous_Billed_Percent__c : 0;
                Decimal currentCompletePercent = item.wfrecon__Scope_Complete__c != null ? item.wfrecon__Scope_Complete__c : 0;
                Decimal minRequiredPercent = previousBilledPercent > currentCompletePercent ? previousBilledPercent : currentCompletePercent;

                Decimal previousGross = previousTotalBilled + previousTotalRetainage;
                Decimal factor = 1 + (retainagePercent / 100);

                Boolean enforceLimits = contractAmount > 0;
                Decimal maxAmount = 0;
                Decimal minAmount = 0;

                if (enforceLimits) {
                    Decimal availableGross = contractAmount - previousGross;
                    if (availableGross < 0) {
                        availableGross = 0;
                    }
                    maxAmount = factor != 0 ? availableGross / factor : availableGross;

                    Decimal requiredGross = contractAmount * (minRequiredPercent / 100);
                    Decimal remainingGrossNeeded = requiredGross - previousGross;
                    if (remainingGrossNeeded < 0) {
                        remainingGrossNeeded = 0;
                    }
                    minAmount = factor != 0 ? remainingGrossNeeded / factor : remainingGrossNeeded;

                    maxAmount = maxAmount.setScale(2, roundingMode);
                    minAmount = minAmount.setScale(2, roundingMode);
                }

                Decimal thisRetainageAmount;
                Decimal totalRetainageAmount;
                Decimal totalBilledAmount;
                Decimal grossToDate;

                if (hasAmountUpdate) {
                    if (thisBillingAmount < 0) {
                        result.put('status', 'ERROR');
                        result.put('message', 'This Billing Amount cannot be negative.');
                        return result;
                    }
                    if (enforceLimits && thisBillingAmount > maxAmount + tolerance) {
                        result.put('status', 'ERROR');
                        result.put('message', 'This Billing Amount plus retainage exceeds the contract value. Adjust the amount or retainage percentage.');
                        return result;
                    }
                    if (enforceLimits && thisBillingAmount < minAmount - tolerance) {
                        result.put('status', 'ERROR');
                        result.put('message', 'This Billing Amount results in completion below the required minimum. Increase the amount or review retainage.');
                        return result;
                    }

                    thisRetainageAmount = (thisBillingAmount * retainagePercent) / 100;
                    totalRetainageAmount = previousTotalRetainage + thisRetainageAmount;
                    totalBilledAmount = previousTotalBilled + thisBillingAmount;
                    grossToDate = totalBilledAmount + totalRetainageAmount;

                    if (enforceLimits && grossToDate > contractAmount + tolerance) {
                        result.put('status', 'ERROR');
                        result.put('message', 'This Billing Amount and retainage exceed the contract value.');
                        return result;
                    }

                    thisBillingPercent = enforceLimits ? (grossToDate / contractAmount) * 100 : 0;
                    if (thisBillingPercent > 100 + tolerance) {
                        result.put('status', 'ERROR');
                        result.put('message', 'This Billing Complete % cannot exceed 100%.');
                        return result;
                    }
                } else if (hasPercentUpdate) {
                    if (thisBillingPercent < 0) {
                        result.put('status', 'ERROR');
                        result.put('message', 'This Billing Complete % cannot be negative.');
                        return result;
                    }
                    if (thisBillingPercent > 100) {
                        result.put('status', 'ERROR');
                        result.put('message', 'This Billing Complete % cannot exceed 100%.');
                        return result;
                    }
                    if (thisBillingPercent < minRequiredPercent - tolerance) {
                        result.put('status', 'ERROR');
                        result.put('message', 'This Billing Complete % must be at least ' + String.valueOf(minRequiredPercent.setScale(2, roundingMode)) + '%.');
                        return result;
                    }

                    grossToDate = enforceLimits ? (contractAmount * thisBillingPercent) / 100 : 0;
                    Decimal grossContribution = grossToDate - previousGross;
                    if (grossContribution < 0) {
                        grossContribution = 0;
                    }

                    thisBillingAmount = factor != 0 ? grossContribution / factor : grossContribution;

                    if (enforceLimits && thisBillingAmount > maxAmount + tolerance) {
                        result.put('status', 'ERROR');
                        result.put('message', 'The requested Billing % would exceed the contract value. Reduce the percentage or adjust retainage.');
                        return result;
                    }
                    if (enforceLimits && thisBillingAmount < minAmount - tolerance) {
                        result.put('status', 'ERROR');
                        result.put('message', 'The requested Billing % results in completion below the required minimum. Increase the percentage.');
                        return result;
                    }

                    thisRetainageAmount = (thisBillingAmount * retainagePercent) / 100;
                    totalRetainageAmount = previousTotalRetainage + thisRetainageAmount;
                    totalBilledAmount = previousTotalBilled + thisBillingAmount;
                    grossToDate = totalBilledAmount + totalRetainageAmount;
                } else {
                    if (thisBillingAmount < 0) {
                        result.put('status', 'ERROR');
                        result.put('message', 'This Billing Amount cannot be negative.');
                        return result;
                    }
                    if (enforceLimits && thisBillingAmount > maxAmount + tolerance) {
                        result.put('status', 'ERROR');
                        result.put('message', 'Retainage % change makes the current Billing Amount exceed the contract value. Adjust the amount before saving.');
                        return result;
                    }
                    if (enforceLimits && thisBillingAmount < minAmount - tolerance) {
                        result.put('status', 'ERROR');
                        result.put('message', 'Retainage % change causes the current Billing Amount to fall below completion minimums. Adjust the amount before saving.');
                        return result;
                    }

                    thisRetainageAmount = (thisBillingAmount * retainagePercent) / 100;
                    totalRetainageAmount = previousTotalRetainage + thisRetainageAmount;
                    totalBilledAmount = previousTotalBilled + thisBillingAmount;
                    grossToDate = totalBilledAmount + totalRetainageAmount;
                    thisBillingPercent = enforceLimits ? (grossToDate / contractAmount) * 100 : thisBillingPercent;
                }

                Decimal roundedAmount = thisBillingAmount.setScale(2, roundingMode);
                Decimal roundedRetainage = thisRetainageAmount.setScale(2, roundingMode);
                Decimal roundedTotalRetainage = totalRetainageAmount.setScale(2, roundingMode);
                Decimal roundedTotalBilled = totalBilledAmount.setScale(2, roundingMode);
                Decimal roundedGross = roundedTotalBilled + roundedTotalRetainage;
                Decimal roundedPercent = enforceLimits ? (roundedGross / contractAmount) * 100 : thisBillingPercent;
                roundedPercent = roundedPercent.setScale(2, roundingMode);

                if (roundedPercent > 100 + tolerance) {
                    result.put('status', 'ERROR');
                    result.put('message', 'This Billing Complete % cannot exceed 100%.');
                    return result;
                }

                Decimal dueThisBilling = roundedAmount - roundedRetainage;
                if (dueThisBilling < 0) {
                    dueThisBilling = 0;
                }
                dueThisBilling = dueThisBilling.setScale(2, roundingMode);

                item.wfrecon__This_Billing_Value__c = roundedAmount;
                item.wfrecon__This_Billing_Percent__c = roundedPercent;
                item.wfrecon__Retainage_Percent_on_Bill_Line_Item__c = retainagePercent.setScale(2, roundingMode);
                item.wfrecon__This_Retainage_Amount__c = roundedRetainage;
                item.wfrecon__Total_Retainage_Amount__c = roundedTotalRetainage;
                item.wfrecon__Total_Billed_Value__c = roundedTotalBilled;
                item.wfrecon__Previous_Billed_Value__c = previousTotalBilled;

                itemsToUpdate.add(item);
            }

            if (!itemsToUpdate.isEmpty()) {
                update itemsToUpdate;
            }

            return result;
        } catch (Exception e) {
            System.debug('Error saving billing line items: ' + e.getMessage());
            ExceptionHandler.logException(new Map<String, Object>{'className' => 'BillingDetailsPageController', 'methodName' => 'saveBillingLineItems', 'exceptionObj' => e, 'moreDetails' =>  e.getMessage()});
            return new Map<String, String>{'status' => 'ERROR', 'message' => 'An error occurred while saving line items.'};
        }
    }

    private static String buildAddress(Account acc) {
        if (acc == null) return '--';
        
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
        
        return !addressParts.isEmpty() ? String.join(addressParts, ', ') : '--';
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