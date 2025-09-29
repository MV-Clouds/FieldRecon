/**
 * @description       : 
 * @author            : ChangeMeIn@UserSettingsUnder.SFDoc
 * @group             : 
 * @last modified on  : 02-23-2022
 * @last modified by  : ChangeMeIn@UserSettingsUnder.SFDoc
**/
public class CostCodeHelper {

    @AuraEnabled
    public static String getCostCodeRecords(){
        List<costCodeListWrapper> costCodeList = new List<costCodeListWrapper>();
        String query = 'SELECT createdDate,Id, Name,Classification_Type__c,Default_Cost_Code__c '+
        'FROM Cost_Code__c ORDER BY createdDate DESC';
        List<Cost_Code__c> ccList = Lib_Security.ws().dbQuery(query,new List<Object>{});

        for(wfrecon__Cost_Code__c cc: ccList){
            costCodeListWrapper costCodeRecords = new costCodeListWrapper();
            costCodeRecords.costCodeName = cc.Name;
            costCodeRecords.classificationType = cc.Classification_Type__c;
            costCodeRecords.defaultCostCode =cc.Default_Cost_Code__c;
            costCodeList.add(costCodeRecords);
        }
        classWrapper cw = new classWrapper();       
        cw.costCodeWrapper = costCodeList;
        return JSON.serialize(cw);
    }

    public static String getNamespace(){        
        return Util.getNamespaceWithUnderscore();
    }

    public class costCodeListWrapper{
        @AuraEnabled public String costCodeName;
        @AuraEnabled public String classificationType;
        @AuraEnabled public Boolean defaultCostCode;
    }

    public class classWrapper{
        @AuraEnabled public List<costCodeListWrapper> costCodeWrapper;   
        @AuraEnabled public String namespaceClassificationField;     
        @AuraEnabled public String namespaceDefaultCostCode;
        @AuraEnabled public String namespaceCostCodeName;
        @AuraEnabled public String namespaceObjectName;
        
        public classWrapper(){
            this.namespaceClassificationField = Util.getNamespaceWithUnderscore() + 'Classification_Type__c';
            this.namespaceDefaultCostCode = Util.getNamespaceWithUnderscore() + 'Default_Cost_Code__c';
            this.namespaceCostCodeName = 'Name';
            this.namespaceObjectName = Util.getNamespaceWithUnderscore() + 'Cost_Code__c';
        }
    }
}