/**
* Class Name: SovJobScopeController
* Test Class: Pending
* @description: Controller for SOV Scope Tab which is in Job Detail Page
* Created Date: 30 September 2025
* Created By: Rachit Shah
*--------------------------------------------------------------------------------
* Modification History:
* Date Modified - Developer Name - Description
* 
**/

public with sharing class SovJobScopeController {

    public static final string CLASSNAME = 'SovJobScopeController';

    /*
    *********************************************************
    @description     : Method is used to get Scope Entries for a Job
    @param           : Id jobId - Job Id
    @return          : List<Scope_Entry__c> - List of Scope Entries
    @author          : Rachit Shah
    ********************************************************
    */
    @AuraEnabled
    public static List<Scope_Entry__c> getScopeEntries(Id jobId) {
        List <Scope_Entry__c> scopeEntries = new List<Scope_Entry__c>();

        try {    
            scopeEntries = [
                SELECT Id, Name, Contract_Value__c, Type__c, Completed_Percentage__c,
                       Current_Complete_Value__c, Amount_Remaining__c,
                       Amount_previously_billed__c, Approved_Date__c,
                       Job__c, Parent_Scope_Entry__c, Scope_Entry_Status__c, Unit_Price__c
                FROM Scope_Entry__c
                WHERE Job__c = :jobId
                WITH USER_MODE
                ORDER BY CreatedDate DESC
            ];
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{
                'className' => CLASSNAME,
                'methodName' => 'getScopeEntries',
                'isApiException' => false,
                'statusCode' => null,
                'exceptionObj' => e,
                'moreDetails' => 'Error occurred while fetching Scope Entries.',
                'apiResponse' => null
            });
        }

        return scopeEntries;
    }

    /*
    *********************************************************
    @description     : Method is used to get Scope Entry Configuration
    @return          : Map<String, Object> - Configuration data
    @author          : Rachit Shah
    ********************************************************
    */
    @AuraEnabled
    public static Map<String, Object> getScopeEntryConfiguration() {
        Map<String, Object> configData = new Map<String, Object>();
        
        try {
            List<wfrecon__ScopeEntryConfigration__mdt> configs = [
                SELECT FieldsData__c, PageSize__c 
                FROM wfrecon__ScopeEntryConfigration__mdt 
                WITH USER_MODE 
                LIMIT 1
            ];

            if (!configs.isEmpty()) {
                wfrecon__ScopeEntryConfigration__mdt config = configs[0];
                configData.put('fieldsData', config.FieldsData__c);
                configData.put('pageSize', config.PageSize__c);
            }
            else{
                configData.put('fieldsData', '');
                configData.put('pageSize', 10);
            }
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{
                'className' => CLASSNAME,
                'methodName' => 'getScopeEntryConfiguration',
                'isApiException' => false,
                'statusCode' => null,
                'exceptionObj' => e,
                'moreDetails' => 'Error occurred while fetching Scope Entry Configuration.',
                'apiResponse' => null
            });
        }

        return configData;
    }

    /*
    *********************************************************
    @description     : Method is used to create a new Scope Entry
    @param           : Map<String, Object> scopeEntryData - Scope Entry data
    @return          : String - Success or error message
    @author          : Rachit Shah
    ********************************************************
    */
    @AuraEnabled
    public static String createScopeEntry(Map<String, Object> scopeEntryData) {
        try {
            Scope_Entry__c newScopeEntry = new Scope_Entry__c();
            newScopeEntry.Name = (String) scopeEntryData.get('name');
            newScopeEntry.Contract_Value__c = (Decimal) scopeEntryData.get('contractValue');
            newScopeEntry.Description__c = (String) scopeEntryData.get('description');
            newScopeEntry.Job__c = (Id) scopeEntryData.get('jobId');
            
            insert as user newScopeEntry;
            return 'Success';
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{
                'className' => CLASSNAME,
                'methodName' => 'createScopeEntry',
                'isApiException' => false,
                'statusCode' => null,
                'exceptionObj' => e,
                'moreDetails' => 'Error occurred while creating Scope Entry.',
                'apiResponse' => null
            });
            return 'Error: ' + e.getMessage();
        }
    }

    /*
    *********************************************************
    @description     : Method is used to delete multiple Scope Entries
    @param           : List<Id> scopeEntryIds - List of Scope Entry Ids to delete
    @return          : String - Success or error message
    @author          : Rachit Shah
    ********************************************************
    */
    @AuraEnabled
    public static String deleteScopeEntries(List<Id> scopeEntryIds) {
        try {
            if (scopeEntryIds.isEmpty()) {
                return 'Error: No records selected for deletion';
            }
            
            List<Scope_Entry__c> scopeEntriesToDelete = [
                SELECT Id 
                FROM Scope_Entry__c 
                WHERE Id IN :scopeEntryIds 
                WITH USER_MODE
            ];
            
            delete as user scopeEntriesToDelete;
            return 'Success';
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{
                'className' => CLASSNAME,
                'methodName' => 'deleteScopeEntries',
                'isApiException' => false,
                'statusCode' => null,
                'exceptionObj' => e,
                'moreDetails' => 'Error occurred while deleting Scope Entries.',
                'apiResponse' => null
            });
            return 'Error: ' + e.getMessage();
        }
    }
}