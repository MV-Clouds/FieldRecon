public with sharing class ManagementTabController {

    public static final String CLASSNAME = 'ManagementTabController';

    @AuraEnabled
    public static List<Process__c> getProcessLibraries() {
        List<Process__c> processLibraries = new List<Process__c>();
        
        try {
            processLibraries = [
                SELECT Id, Name, Process_Name__c, Weight__c, Unit_of_Measure__c, Process_Type__c
                FROM Process__c
                WITH USER_MODE
                ORDER BY CreatedDate DESC
            ];
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => CLASSNAME, 'methodName' => 'getProcessLibraries', 'isApiException' => false, 'statusCode' => null, 'exceptionObj' => e,'moreDetails' => 'Error fetching Process Libraries : ' + e.getMessage(), 'apiResponse' => null});
        }

        return processLibraries;
    }

    @AuraEnabled
    public static List<Crew__c> getCrewMembers() {
        List<Crew__c> crewMembers = new List<Crew__c>();
        
        try {
            crewMembers = [
                SELECT Id, Name, Description__c, Crew_Member_Count__c
                FROM Crew__c
                WITH USER_MODE
                ORDER BY CreatedDate DESC
            ];
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => CLASSNAME, 'methodName' => 'getCrewMembers', 'isApiException' => false, 'statusCode' => null, 'exceptionObj' => e,'moreDetails' => 'Error fetching Crew Members : ' + e.getMessage(), 'apiResponse' => null});
        }

        return crewMembers;
    }

    @AuraEnabled
    public static String deleteProcess(String processId) {
        try {
            
            if (processId != null) {
                delete as user (new Process__c(Id = processId));
                return 'Success';
            } else {
                return 'Process not found';
            }
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => CLASSNAME, 'methodName' => 'deleteProcess', 'isApiException' => false, 'statusCode' => null, 'exceptionObj' => e,'moreDetails' => 'Error deleting Process : ' + e.getMessage(), 'apiResponse' => null});
            return 'Error: ' + e.getMessage();
        }
    }

    @AuraEnabled
    public static String deleteCrew(String crewId) {
        try {
            if (crewId != null) {
                delete as user (new Crew__c(Id = crewId));  
                return 'Success';
            } else {
                return 'Crew not found';
            }
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => CLASSNAME, 'methodName' => 'deleteCrew', 'isApiException' => false, 'statusCode' => null, 'exceptionObj' => e,'moreDetails' => 'Error deleting Crew : ' + e.getMessage(), 'apiResponse' => null});
            return 'Error: ' + e.getMessage();
        }
    }

    @AuraEnabled
    public static List<wfrecon__Cost_Code__c> getCostCodes() {
        List<wfrecon__Cost_Code__c> costCodes = new List<wfrecon__Cost_Code__c>();
        
        try {
            costCodes = [
                SELECT Id, Name, wfrecon__Classification_Type__c, wfrecon__Code__c, wfrecon__Level_Code__c
                FROM wfrecon__Cost_Code__c
                WITH USER_MODE
                ORDER BY CreatedDate DESC
            ];
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => CLASSNAME, 'methodName' => 'getCostCodes', 'isApiException' => false, 'statusCode' => null, 'exceptionObj' => e,'moreDetails' => 'Error fetching Cost Codes : ' + e.getMessage(), 'apiResponse' => null});
        }

        return costCodes;
    }

    @AuraEnabled
    public static String deleteCostCode(String costCodeId) {
        try {
            if (costCodeId != null) {
                delete as user (new wfrecon__Cost_Code__c(Id = costCodeId));
                return 'Success';
            } else {
                return 'Cost Code not found';
            }
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => CLASSNAME, 'methodName' => 'deleteCostCode', 'isApiException' => false, 'statusCode' => null, 'exceptionObj' => e,'moreDetails' => 'Error deleting Cost Code : ' + e.getMessage(), 'apiResponse' => null});
            return 'Error: ' + e.getMessage();
        }
    }
}