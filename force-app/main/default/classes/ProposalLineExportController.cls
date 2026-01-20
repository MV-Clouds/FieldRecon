/**
* Class Name: ProposalLineExportController
* Test Class: Pending
* @description: Apex Controller to handle exporting Proposal Lines to Job Scope of Work Entries.
* Created Date: 20 Jan 2026
* Created By: Vyom Soni
*--------------------------------------------------------------------------------
* Modification History:
* Date Modified - Developer Name - Description
* 
**/
public with sharing class ProposalLineExportController {

    /*
    *********************************************************
    @description     : Fetches Proposal details including its Lines for export
    @param           : Id proposalId - The Id of the Proposal to fetch details for
    @return          : Map<String, Object> - Map containing Proposal details and Lines
    @author          : Vyom Soni
    ********************************************************
    */
    @AuraEnabled
    public static Map<String, Object> getProposalDetails(Id proposalId) {
        Map<String, Object> result = new Map<String, Object>();
        try {
            // Fetch Proposal, check Type/Status, and navigate to Proposal's Job
            // Assumes Proposal -> Job (wfrecon__Job__c) relationship
            wfrecon__Proposal__c prop = [
                SELECT Id, Name, wfrecon__Type__c, wfrecon__Status__c, 
                       wfrecon__Job__c
                FROM wfrecon__Proposal__c 
                WHERE Id = :proposalId WITH USER_MODE
                LIMIT 1
            ];

            result.put('proposal', prop);
            result.put('jobId', prop.wfrecon__Job__c);
            
            // Fetch Proposal Lines
            List<wfrecon__Proposal_Line__c> lines = [
                SELECT Id, Name, wfrecon__Description__c, wfrecon__Sales_Price__c 
                FROM wfrecon__Proposal_Line__c 
                WHERE wfrecon__Proposal__c = :proposalId
                AND wfrecon__Type__c = 'Base Contract' WITH USER_MODE
                ORDER BY Name ASC
            ];
            
            result.put('lines', lines);
            result.put('success', true);

        } catch (Exception e) {
            result.put('success', false);
            result.put('message', e.getMessage());
            ExceptionHandler.logException(new Map<String, Object>{'className' => 'ProposalLineExportController', 'methodName' => 'getProposalDetails', 'isApiException' => false, 'statusCode' => null, 'exceptionObj' => e, 'moreDetails' => 'Error fetching proposal details.','apiResponse' => null});
        }
        return result;
    }

    /*
    *********************************************************
    @description     : Creates Job Scope of Work Entries from selected Proposal Lines
    @param           : String scopeEntriesDataJson - JSON string of Scope Entry data to create
    @return          : Map<String, Object> - Map indicating success/failure and details
    @author          : Vyom Soni
    ********************************************************
    */
    @AuraEnabled
    public static Map<String, Object> createJobSovLines(String scopeEntriesDataJson) {
        Map<String, Object> result = new Map<String, Object>();
        SavePoint sp = Database.setSavepoint();
        
        try {
            if (String.isBlank(scopeEntriesDataJson)) {
                throw new AuraHandledException('No data provided for export.');
            }

            List<Object> dataList = (List<Object>) JSON.deserializeUntyped(scopeEntriesDataJson);
            List<wfrecon__Scope_Entry__c> newEntries = new List<wfrecon__Scope_Entry__c>();

            for (Object item : dataList) {
                Map<String, Object> mapItem = (Map<String, Object>) item;
                
                wfrecon__Scope_Entry__c entry = new wfrecon__Scope_Entry__c();
                entry.Name = (String) mapItem.get('name');
                entry.wfrecon__Description__c = (String) mapItem.get('description');
                
                // Handle Decimal conversion safely
                Object priceObj = mapItem.get('contractValue');
                entry.wfrecon__Contract_Value__c = priceObj != null ? Decimal.valueOf(String.valueOf(priceObj)) : 0;
                
                entry.wfrecon__Job__c = (Id) mapItem.get('jobId');
                entry.wfrecon__Type__c = 'Change Order'; // As per requirement source logic
                entry.wfrecon__Scope_Entry_Status__c = 'Draft';

                newEntries.add(entry);
            }

            if (!newEntries.isEmpty()) {
                insert as user newEntries;
                result.put('success', true);
                result.put('count', newEntries.size());
            } else {
                result.put('success', false);
                result.put('message', 'No lines to insert.');
            }

        } catch (Exception e) {
            Database.rollback(sp);
            result.put('success', false);
            result.put('message', e.getMessage());
            ExceptionHandler.logException(new Map<String, Object>{'className' => 'ProposalLineExportController', 'methodName' => 'createJobSovLines', 'isApiException' => false, 'statusCode' => null, 'exceptionObj' => e, 'moreDetails' => 'Error creating Job Scope of Work Entries.','apiResponse' => null});
        }
        return result;
    }
}