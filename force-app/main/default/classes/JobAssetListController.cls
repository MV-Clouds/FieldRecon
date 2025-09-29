public with sharing class JobAssetListController {
    @AuraEnabled
    public static List<Equipment__c> getDefault(String JobId) {
        try {
            if(!Util.thirdLevelFeatureAccess()){
                throw new HandledException('Third Level Feature not Enabled!');
            }
            String soql = 'SELECT Id, Equipment__c, Equipment__r.Name, Equipment__r.Status__c, Equipment__r.Asset_Type__c'+
                        ' FROM Mobilization_Asset__c WHERE Mobilization__r.Job__c = :arg1 WITH SECURITY_ENFORCED';
            List<Mobilization_Asset__c> assetList = Lib_Security.ws().dbQuery(soql,new Object[]{JobId});
        
            Map<Id, Equipment__c> assetMap = new Map<Id, Equipment__c>();
            for (Mobilization_Asset__c ma : assetList) {
                if (!assetMap.containsKey(ma.Equipment__c)) {
                    Equipment__c a = new Equipment__c();
                    a.Name = ma.Equipment__r.Name;
                    a.Status__c = ma.Equipment__r.Status__c;
                    a.Asset_Type__c = ma.Equipment__r.Asset_Type__c;
                    assetMap.put(ma.Equipment__c, a);
                }
            }

            return assetMap.values();

        } catch (Exception e) {
            throw new HandledException(e.getMessage());
        }
    }

    public class Assets {
        @AuraEnabled
        public String Name;
        @AuraEnabled
        public String Status;
        @AuraEnabled
        public String Type;
    }
}