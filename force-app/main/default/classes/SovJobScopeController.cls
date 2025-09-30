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
}
