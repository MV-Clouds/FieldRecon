public with sharing class ManageQuantityController {
    @AuraEnabled
    public static Equipment__c getDefaults(String recordId) {
            String soql = 'SELECT Id, Quantity__c FROM Equipment__c WHERE Id = :arg1 WITH SECURITY_ENFORCED LIMIT 1';
            Equipment__c[] ast = Lib_Security.ws().dbQuery(soql, new Object[]{recordId});
            
            return ast[0];
    }

    @AuraEnabled
    public static void AddQuantity(String recordId, Decimal Quan) {
            String soql = 'SELECT Id, Quantity__c FROM Equipment__c WHERE Id = :arg1 WITH SECURITY_ENFORCED LIMIT 1';
            Equipment__c[] ast = Lib_Security.ws().dbQuery(soql, new Object[]{recordId});
            
            Decimal Quant = (ast[0].Quantity__c == null ? 0 : ast[0].Quantity__c) + Quan;
            Equipment__c asst = new Equipment__c();
            asst.Id = ast[0].Id;
        
            asst.Quantity__c = Quant;
            Lib_Security.ws().dbUpdate(new Equipment__c []{asst});
    }
    @AuraEnabled
    public static void RemoveQuantity(String recordId, Decimal Quan) {
            String soql = 'SELECT Id, Quantity__c FROM Equipment__c WHERE Id = :arg1 WITH SECURITY_ENFORCED LIMIT 1';
            Equipment__c[] ast = Lib_Security.ws().dbQuery(soql, new Object[]{recordId});
            
            Decimal Quant = (ast[0].Quantity__c == null ? 0 : ast[0].Quantity__c) - Quan;
            Equipment__c asst = new Equipment__c();
            asst.Id = recordId;
            
            asst.Quantity__c = Quant;
            Lib_Security.ws().dbUpdate(new Equipment__c[]{asst});
    }
}