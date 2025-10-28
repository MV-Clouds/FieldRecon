/**
 * @description       : handler class for mobilization to copy members and assets to the coming one
 * @author            : Concret.io
 * @group             : 
 * @last modified on  : 04-21-2021
 * @last modified by  : Concret.io
 * Modifications Log 
 * Ver   Date         Author               Modification
 * 1.0   04-21-2021   Concret.io          Initial Version
**/
public with sharing class MobilizationTriggerHandler {
    //public list of members and assets
    public static List<Mobilization_Member__c> insertMobMembers = new List<Mobilization_Member__c>();
    public static List<Mobilization_Asset__c> insertMobAssets = new List<Mobilization_Asset__c>();

    /**
    * @description a method to add mobilization member and asset to those mobilization who's 
                    mobilization group has AddAssetUser__c custom field true
    * @author Concret.io | 04-21-2021 
    * @param newRecords a list of new mobilization
    **/
    public static void handleAfterInsert(List<Mobilization__c> newRecords) {
        Set<Id> mobGroupIds = new Set<Id>();
        for(Mobilization__c mob : newRecords){
            mobGroupIds.add(mob.Mobilization_Group__c);
        }
        List<Mobilization_Group__c> mobGroups = Lib_Security.ws().dbQuery('SELECT Id, (SELECT Id,Mobilization_Group__c FROM Mobilizations__r) FROM Mobilization_Group__c WHERE Id IN :arg1 AND AddAssetUser__c = true',new Object[]{mobGroupIds});
        for(Mobilization_Group__c mGroup : mobGroups){
            if(mGroup.Mobilizations__r == null || mGroup.Mobilizations__r.size() == 0) continue;
            createMobilizationMembersAndAssets(newRecords,mGroup.Mobilizations__r,mGroup);
        }
        if(!MobilizationTriggerHandler.insertMobAssets.isEmpty()){
            Lib_Security.ws().dbUpsert(MobilizationTriggerHandler.insertMobAssets);
        }
        if(!MobilizationTriggerHandler.insertMobMembers.isEmpty()){
            Lib_Security.ws().dbUpsert(MobilizationTriggerHandler.insertMobMembers);
        }
    }
    /**
    * @description private method to create members and assets for the new mobilizations
    * @author Concret.io | 04-21-2021 
    * @param targetMobs mobilization for whom we have to create members and assets 
    * @param sourceMobs mobilization from which we have copy the members and assets
    * @param mobGroup parent group of mobilizations
    **/
    private static void createMobilizationMembersAndAssets(List<Mobilization__c> targetMobs,List<Mobilization__c> sourceMobs,Mobilization_Group__c mobGroup){
        String query =
            'SELECT ' +
            'Mobilization_Group__c, ' +
            '( ' +
            '    SELECT ' +
            '    Id, ' +
            '    Date_on_Site__c, ' +
            '    Mobilization__c, ' +
            '    Contact__c, ' +
            '    Contact__r.User__c ' +
            'FROM Mobilization_Members__r ' +
            'WHERE Contact__r.User__c != null ' +
            '), ' +
            '( ' +
            'SELECT Id, Mobilization__c, Equipment__c, Active__c ' +
            'FROM Mobilization_Assets__r ' +
            'WHERE Active__c = true ' +
            ') ' +
            'FROM Mobilization__c ' +
            'WHERE id IN :arg1 AND Mobilization_Group__c = :arg2 ' +
            'WITH SECURITY_ENFORCED ';
        List<Mobilization__c> mobilizationList = Lib_Security.ws()
            .dbQuery(query, new List<Object>{ sourceMobs , mobGroup.Id});
        Map<Id,Mobilization_Member__c> mobMembers = new Map<Id,Mobilization_Member__c>();
        Map<Id,Mobilization_Asset__c> mobAssets = new Map<Id,Mobilization_Asset__c>();
        //preparing maps for keeping the unique records of mobilization members and assets
        for (Mobilization__c rm : mobilizationList) {
            for (Mobilization_Member__c mtm : rm.Mobilization_Members__r) {
                mobMembers.put(mtm.Contact__c,mtm);
            }
            for (Mobilization_Asset__c ma : rm.Mobilization_Assets__r) {
                mobAssets.put(ma.Equipment__c,ma);
            }
        }
        //creating new mobilization members and assets for the mobilization
        for (Mobilization__c rm : targetMobs) {
            if(rm.Mobilization_Group__c != sourceMobs[0].Mobilization_Group__c) continue;
            for (Mobilization_Member__c mtm : mobMembers.values()) {
                MobilizationTriggerHandler.insertMobMembers.add(new Mobilization_Member__c(Mobilization__c = rm.Id, Contact__c = mtm.Contact__c));
            }
            for (Mobilization_Asset__c ma : mobAssets.values()) {
                MobilizationTriggerHandler.insertMobAssets.add(new Mobilization_Asset__c(Mobilization__c = rm.Id,Active__c = true,Equipment__c = ma.Equipment__c));
            }
        }
    }
    public static void handleAfterDelete(List<wfrecon__Mobilization__c> mobilizations){
        Set<Id> mobGroupIds = new Set<Id>();
        Set<Id> mobGroupIdsToBeDeleted = new Set<Id>();
        for(wfrecon__Mobilization__c mob : mobilizations){
            mobGroupIds.add(mob.wfrecon__Mobilization_Group__c);
        }
        String query = 'SELECT Id, (SELECT Id FROM wfrecon__Mobilizations__r) FROM wfrecon__Mobilization_Group__c WHERE Id IN :arg1';
        for(wfrecon__Mobilization_Group__c mGroup : (wfrecon__Mobilization_Group__c[])Lib_Security.ws().dbQuery(query, new Object[]{mobGroupIds})){
            if(mGroup.wfrecon__Mobilizations__r.size() == 0){
                mobGroupIdsToBeDeleted.add(mGroup.id);
            }
        }
        if(mobGroupIdsToBeDeleted.isEmpty()){return;}
        MobilizationGroupTriggerHandler.runOnce = false;
        Lib_Security.ws().dbDelete(Lib_Security.ws().dbQuery('SELECT Id FROM wfrecon__Mobilization_Group__c WHERE Id IN :arg1',new Object[]{mobGroupIdsToBeDeleted}));
    	MobilizationGroupTriggerHandler.runOnce = true;
    }
}