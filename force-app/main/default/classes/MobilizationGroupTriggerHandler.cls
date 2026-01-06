/**
 * @description       : handler class to handle inser, update and delete operation on groups
 * @author            : Concret.io
 * @group             : 
 * @last modified on  : 06-17-2021
 * @last modified by  : Ashita Kothari
 * Modifications Log 
 * Ver   Date         Author       Modification
 * 1.0   04-21-2021   Concret.io   Initial Version
**/
public with sharing class MobilizationGroupTriggerHandler {
    public static Boolean runOnce = true;
   
    /**
    * @description method to create mobilization from the start date to end date of mob group
    * @author Concret.io | 04-21-2021 
    * @param mobGroups 
    **/
    public static void handleAfterInsert(List<Mobilization_Group__c> mobGroups){
        List<Mobilization__c> mobilizationsToInsert = new List<Mobilization__c>();

        for(Mobilization_Group__c mobGroup : mobGroups){
            mobilizationsToInsert.addAll(createNewMobilization(mobGroup.Start_Date__c,mobGroup.End_Date__c,mobGroup));
        }
        if (mobilizationsToInsert.size() > 0) {
            Lib_Security.ws().dbInsert(mobilizationsToInsert);
        }
    }
    /**
    * @description method to update the mobilization the updated mobilization groups
    * @author Concret.io | 04-21-2021 
    * @param newMobGroups new update mobilization groups
    * @param oldMobGroups old mobilization groups
    **/
    public static void handleAfterUpdate(List<Mobilization_Group__c> newMobGroups,Map<Id,Mobilization_Group__c> oldMobGroups){
        
        Boolean isMidnight = false;
        List<Mobilization_Group__c> mobGroups = new List<Mobilization_Group__c>();
        List<Mobilization_Group__c> mobGroupsWithWeekendChanges = new List<Mobilization_Group__c>();
        
        //filtering records based on criteria
        for(Mobilization_Group__c mg : newMobGroups){
            // Check if Include_Saturday or Include_Sunday changed
            Boolean saturdayChanged = mg.Include_Saturday__c != oldMobGroups.get(mg.Id).Include_Saturday__c;
            Boolean sundayChanged = mg.Include_Sunday__c != oldMobGroups.get(mg.Id).Include_Sunday__c;
            
            if(saturdayChanged || sundayChanged){
                // If weekend settings changed, we need to delete all and recreate
                mobGroupsWithWeekendChanges.add(mg);
            } else if(mg.Start_Date__c != oldMobGroups.get(mg.Id).Start_Date__c ||
               mg.End_Date__c != oldMobGroups.get(mg.Id).End_Date__c || 
               mg.Mobilization_Status__c != oldMobGroups.get(mg.Id).Mobilization_Status__c){
                mobGroups.add(mg);
            }
        }
        
        // Handle weekend setting changes by deleting and recreating all mobilizations
        if(!mobGroupsWithWeekendChanges.isEmpty()){
            // First, query the full Mobilization Group records to ensure we have all fields
            String weekendSoql = 'SELECT Id, Name, Start_Date__c, End_Date__c, Mobilization_Status__c, Job__c, Include_Saturday__c, Include_Sunday__c ' +
                'FROM Mobilization_Group__c WHERE Id IN :arg1';
            List<Mobilization_Group__c> fullMobGroups = (Mobilization_Group__c[]) Lib_Security.ws()
                .dbQuery(weekendSoql, new List<Object>{mobGroupsWithWeekendChanges});
            
            // Use runOnce flag to prevent recursion
            MobilizationGroupTriggerHandler.runOnce = false;
            
            // Delete existing mobilizations
            String deleteSoql = 'SELECT Id FROM Mobilization__c WHERE Mobilization_Group__c IN :arg1';
            List<Mobilization__c> mobsToDelete = (Mobilization__c[]) Lib_Security.ws()
                .dbQuery(deleteSoql, new List<Object>{fullMobGroups});
            
            if(!mobsToDelete.isEmpty()){
                Lib_Security.ws().dbDelete(mobsToDelete);
            }
            
            // Recreate all mobilizations with new weekend settings
            List<Mobilization__c> newMobilizations = new List<Mobilization__c>();
            for(Mobilization_Group__c mg : fullMobGroups){
                newMobilizations.addAll(createNewMobilization(mg.Start_Date__c, mg.End_Date__c, mg));
            }
            
            if(!newMobilizations.isEmpty()){
                Lib_Security.ws().dbInsert(newMobilizations);
            }
            
            // Reset runOnce flag
            MobilizationGroupTriggerHandler.runOnce = true;
        }
        
        // Handle other changes (dates, status) with the existing logic
        if(mobGroups.isEmpty()){
            return;
        }
        
        String soql ='SELECT Id,Name,Start_Date__c,End_Date__c,Mobilization_Status__c,Job__c,Include_Saturday__c,Include_Sunday__c,AddAssetUser__c, '+
            ' (SELECT Id,Mobilization_Status__c, Start_Date__c, End_Date__c,Job__c, Mobilization_Group__c FROM Mobilizations__r) '+
            ' FROM Mobilization_Group__c Where Id IN :arg1';
        List<Mobilization_Group__c> allMobilizationWithGroups = (Mobilization_Group__c[]) Lib_Security.ws()
            .dbQuery(soql, new List<Object>{mobGroups});

        List<Mobilization__c> mobilizationsToUpsert = new List<Mobilization__c>();
        List<Mobilization__c> mobilizationsToDelete = new List<Mobilization__c>();

        //logic for create or remove the mobilizations
        for(Mobilization_Group__c mobGroup : allMobilizationWithGroups){

            isMidnight = false;
            if(Time.newInstance(mobGroup.Start_Date__c.hour(), mobGroup.Start_Date__c.minute(), 0, 0) >=  Time.newInstance(12, 00, 0, 0) && Time.newInstance(mobGroup.Start_Date__c.hour(), mobGroup.Start_Date__c.minute(), 0, 0) <=  Time.newInstance(23, 59, 59, 0) 
                && Time.newInstance(mobGroup.End_Date__c.hour(), mobGroup.End_Date__c.minute(), 0, 0) >=  Time.newInstance(00, 00, 0, 0) && Time.newInstance(mobGroup.End_Date__c.hour(), mobGroup.End_Date__c.minute(), 0, 0) <=  Time.newInstance(12, 00, 0, 0))
            {
                isMidnight = true;
            }
            List<Mobilization__c> mobilizations = mobGroup.Mobilizations__r;
            DateTime dateCounter;
            //creating the new one
            if(oldMobGroups.get(mobGroup.Id).Start_Date__c > mobGroup.Start_Date__c){
                Integer countRecords = (oldMobGroups.get(mobGroup.Id).Start_Date__c.date().daysBetween(mobGroup.End_Date__c.date())) + 1;
                countRecords+= oldMobGroups.get(mobGroup.Id).End_Date__c.date().daysBetween(mobGroup.End_Date__c.date());
                dateCounter = mobGroup.End_Date__c;
                mobilizationsToUpsert.addAll(createNewMobilization(mobGroup.Start_Date__c,isMidnight == true ? dateCounter.addDays(-(countRecords - 1)) :dateCounter.addDays(-countRecords) ,mobGroup));
            }
            if(oldMobGroups.get(mobGroup.Id).End_Date__c < mobGroup.End_Date__c){
                Integer countRecords = (oldMobGroups.get(mobGroup.Id).Start_Date__c.date().daysBetween(oldMobGroups.get(mobGroup.Id).End_Date__c.date())) + 1;
                countRecords+= mobGroup.Start_Date__c.date().daysBetween(oldMobGroups.get(mobGroup.Id).Start_Date__c.date());
                dateCounter = mobGroup.Start_Date__c;
                mobilizationsToUpsert.addAll(createNewMobilization(isMidnight == true ? dateCounter.addDays(countRecords - 1) :dateCounter.addDays(countRecords),mobGroup.End_Date__c,mobGroup));
            }
            dateCounter = oldMobGroups.get(mobGroup.Id).Start_Date__c;
            //updating the existing one
            for (Mobilization__c m : mobilizations) {
                dateCounter = m.Start_Date__c;
                m.Mobilization_Status__c = mobGroup.Mobilization_Status__c;
                m.Start_Date__c = DateTime.newInstance(
                    dateCounter.year(),
                    dateCounter.month(),
                    dateCounter.day(),
                    mobGroup.Start_Date__c.hour(),
                    mobGroup.Start_Date__c.minute(),
                    mobGroup.Start_Date__c.second()
                );
                m.End_Date__c = DateTime.newInstance(
                    dateCounter.year(),
                    dateCounter.month(),
                    isMidnight == true ? dateCounter.day()+1 :dateCounter.day(),
                    mobGroup.End_Date__c.hour(),
                    mobGroup.End_Date__c.minute(),
                    mobGroup.End_Date__c.second()
                );
                mobilizationsToUpsert.add(m);
            }
            //deleting the extra one
            if(oldMobGroups.get(mobGroup.Id).Start_Date__c < mobGroup.Start_Date__c){
                dateCounter = mobGroup.Start_Date__c;
                //dateCounter=isMidnight == true ? dateCounter.addDays(1) : dateCounter;
                mobilizationsToDelete.addAll(deleteMobilizations(oldMobGroups.get(mobGroup.Id).Start_Date__c,dateCounter.addDays(-1),mobilizationsToUpsert));
            }
            if(oldMobGroups.get(mobGroup.Id).End_Date__c > mobGroup.End_Date__c){
                dateCounter = mobGroup.End_Date__c;
                dateCounter=isMidnight == true ? dateCounter.addDays(-1) : dateCounter;
                mobilizationsToDelete.addAll(deleteMobilizations(dateCounter.addDays(1),oldMobGroups.get(mobGroup.Id).End_Date__c,mobilizationsToUpsert));
            }
        }
        if(!mobilizationsToUpsert.isEmpty()){
            Lib_Security.ws().dbUpsert(mobilizationsToUpsert);
        }
        if(!mobilizationsToDelete.isEmpty()){
            Lib_Security.ws().dbDelete(mobilizationsToDelete);
        } 
    }
    /**
    * @description method to delete all mobilization for the deleted mobilization groups
    * @author Concret.io | 04-21-2021 
    * @param mobGroups 
    **/
    public static void handleBeforeDelete(List<Mobilization_Group__c> mobGroups){
        List<Mobilization__c> mobToDelete = Lib_Security.ws().dbQuery('Select Id,Name From Mobilization__c Where Mobilization_Group__c IN :arg1',
                                            new Object[]{mobGroups});

        if(!mobToDelete.isEmpty()){
            MobilizationGroupTriggerHandler.runOnce = false;
            Lib_Security.ws().dbDelete(mobToDelete);
            MobilizationGroupTriggerHandler.runOnce = true;
        }
    }
    /**
    * @description method for creating new mobilizations for the mobilization groups
    * @author Concret.io | 04-21-2021 
    * @param startDateTime 
    * @param endDateTime 
    * @param mobGroup 
    * @return List<Mobilization__c> 
    **/
    private static List<Mobilization__c> createNewMobilization(DateTime startDateTime,DateTime endDateTime,Mobilization_Group__c mobGroup){
        System.debug(startDateTime);
        System.debug(endDateTime);
        List<Mobilization__c> mobilizationsToInsert = new List<Mobilization__c>();
        Boolean isMidnight = false;
        Date startDate = Date.newInstance(startDateTime.year(), startDateTime.month(), startDateTime.day());
        Date endDate = Date.newInstance(endDateTime.year(), endDateTime.month(), endDateTime.day());

        Time shiftStart = Time.newInstance(startDateTime.hour(), startDateTime.minute(), 0, 0);
        Time shiftEnd = Time.newInstance(endDateTime.hour(), endDateTime.minute(), 0, 0);

        if(shiftStart >=  Time.newInstance(12, 00, 0, 0) && shiftStart <=  Time.newInstance(23, 59, 59, 0) 
            && shiftEnd >=  Time.newInstance(00, 00, 0, 0) && shiftEnd <=  Time.newInstance(12, 00, 0, 0))
            {
                isMidnight = true;
            }
        System.debug(isMidnight);
        Date dateCounter = startDate;
        
        while (dateCounter <= endDate) {
            if(isMidnight == true && (endDateTime.day() - dateCounter.day()) == 0 ){
                break;
            }
            if(!mobGroup.Include_Saturday__c && (DateTime.newInstance(dateCounter, Time.newInstance(0, 0, 0, 0))).format('EEEE') == 'Saturday'){
                dateCounter = dateCounter.addDays(1);
                continue;
            }
            if(!mobGroup.Include_Sunday__c && (DateTime.newInstance(dateCounter, Time.newInstance(0, 0, 0, 0))).format('EEEE') == 'Sunday'){
                dateCounter = dateCounter.addDays(1);
                continue;
            }
            mobilizationsToInsert.add(
                new Mobilization__c(
                    Job__c = mobGroup.Job__c,
                    Start_Date__c = DateTime.newInstance(
                        dateCounter.year(),
                        dateCounter.month(),
                        dateCounter.day(),
                        shiftStart.hour(),
                        shiftStart.minute(),
                        shiftStart.second()
                    ),
                    End_Date__c = DateTime.newInstance(
                        dateCounter.year(),
                        dateCounter.month(),
                        isMidnight == true ? dateCounter.day() + 1 : dateCounter.day(),
                        shiftEnd.hour(),
                        shiftEnd.minute(),
                        shiftEnd.second()
                    ),
                    Mobilization_Status__c = mobGroup.Mobilization_Status__c,
                    Mobilization_Group__c = mobGroup.Id
                )
            );
            
            dateCounter = dateCounter.addDays(1);
        }
        return mobilizationsToInsert;
    }
    /**
    * @description this method will delete all the records from the start date to end date 
    * @author Concret.io | 04-21-2021 
    * @param startDateTime 
    * @param endDateTime 
    * @param mobs 
    * @return List<Mobilization__c> 
    **/
    private static List<Mobilization__c> deleteMobilizations(DateTime startDateTime,DateTime endDateTime,List<Mobilization__c> mobs){
        List<Mobilization__c> mobToDelete = new List<Mobilization__c>();
        for(Mobilization__c mob : mobs){
            if((mob.Start_Date__c.date() > startDateTime.date() || mob.Start_Date__c.date().daysBetween( startDateTime.date()) == 0) && 
                (mob.Start_Date__c.date() < endDateTime.date() || mob.Start_Date__c.date().daysBetween(endDateTime.date()) == 0)){
                    mobToDelete.add(mob);
                }
        }
        return mobToDelete;
    }
}