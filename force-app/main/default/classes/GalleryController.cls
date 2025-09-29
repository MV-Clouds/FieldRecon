/**
 * @description       : 
 * @author            : ChangeMeIn@UserSettingsUnder.SFDoc
 * @group             : 
 * @last modified on  : 04-23-2021
 * @last modified by  : Concret.io
 * Modifications Log 
 * Ver   Date         Author                               Modification
 * 1.0   04-07-2021   ChangeMeIn@UserSettingsUnder.SFDoc   Initial Version
**/
public with sharing class GalleryController {
    @AuraEnabled
    public static List<ContantDoc> getContents(Id jobID) {
        Set<Id> recIds = new Set<Id>{jobId};
        Map<Id,Opportunity> opportunities = new Map<Id,Opportunity>();
        String sObjName = jobID.getSObjectType().getDescribe().getName();
        Map<Id,wfrecon__Job__c> jobs = new Map<Id,wfrecon__Job__c>((List<wfrecon__Job__c>)Lib_Security.ws().dbQuery('SELECT Id,wfrecon__Job_Name__c FROM wfrecon__Job__c WHERE Id =:arg1', new Object[]{jobID}));
        
       
        if(sObjName == 'wfrecon__Job__c'){
            String soqlQuery = 'SELECT Id, wfrecon__Job__c,Name FROM Opportunity WHERE wfrecon__Job__c =:arg1';
            opportunities = new Map<Id,Opportunity>((List<Opportunity>)Lib_Security.ws().dbQuery(soqlQuery, new Object[]{jobID}));
            recIds.addAll(opportunities.keySet());
        }
        Map<Id, ContantDoc> ContactDocumentMap = new Map<Id, ContantDoc>();
        String soql = 'SELECT Id, ContentDocumentId,ContentDocument.Title,LinkedEntityId FROM ContentDocumentLink WHERE LinkedEntityId = :arg1 '+
                    'ORDER BY Id DESC';
        
        for(ContentDocumentLink cdl : (ContentDocumentLink[])Lib_Security.ws().dbQuery(soql, new Object[]{recIds})) {
            String recordName = '';
            if(jobs.containsKey(cdl.LinkedEntityId)){
                recordName = 'Job : '+jobs.get(cdl.LinkedEntityId).wfrecon__Job_Name__c;
            }else if(opportunities.containsKey(cdl.LinkedEntityId)){
                recordName = 'Opportunity : '+opportunities.get(cdl.LinkedEntityId).Name;
            }
            ContactDocumentMap.put(cdl.ContentDocumentId, new ContantDoc(cdl.ContentDocument?.Title, cdl.ContentDocumentId, '',cdl.LinkedEntityId,recordName));
        }
        Map<Id, ContentVersion> ContentVersionMap = new Map<Id, ContentVersion>();
        String query = 'SELECT Id, ContentDocumentId FROM ContentVersion WHERE ContentDocumentId IN :arg1';
        for(ContentVersion cv : (ContentVersion[])Lib_Security.ws().dbQuery(query, new Object[]{ContactDocumentMap.keySet()})){
            ContentVersionMap.put(cv.Id,cv);
        }
    
        String jobQuery = 'SELECT Id, ParentId, Title, RelatedRecordId, Body FROM Job__Feed WHERE ParentId = :arg1';
        
        for(Job__Feed fd : (Job__Feed[])Lib_Security.ws().dbQuery(jobQuery, new Object[]{jobID})) {
            for (String cdl : ContactDocumentMap.keySet()) {
                if (String.isNotBlank(fd.body) && String.isNotEmpty(fd.body)) {
                    if (fd.Body.contains(cdl)) {
                        ContactDocumentMap.get(cdl).feedId = fd.Id;
                    }
                }
            }

            if (ContentVersionMap.containsKey(fd.RelatedRecordId)) {
                ContactDocumentMap.get(ContentVersionMap.get(fd.RelatedRecordId).ContentDocumentId).feedId = fd.Id;
            }
        }
        return ContactDocumentMap.values();
    }

    public class ContantDoc {
        @AuraEnabled
        public String name;
        @AuraEnabled
        public String fileId;
        @AuraEnabled
        public String feedId;
        @AuraEnabled
        public String parentId;
        @AuraEnabled
        public String parentName;

        public ContantDoc(String Name, String fileId, String feedId,String parentId,String parentName) {
            this.name = Name;
            this.fileId = fileId;
            this.feedId = feedId;
            this.parentId = parentId;
            this.parentName = parentName;
        }
    }
}