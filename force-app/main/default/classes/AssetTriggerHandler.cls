public with sharing class AssetTriggerHandler {
    List<Equipment__c> recordNewList = new List<Equipment__c>();
    List<Equipment__c> recordOldList = new List<Equipment__c>();
    Map<Id, Equipment__c> recordNewMap = new Map<Id, Equipment__c>();
    Map<Id, Equipment__c> recordOldMap = new Map<Id, Equipment__c>();
    Boolean isInsert, isUpdate, isDelete, isUndelete = false;
    public static boolean recursionController = false;
    

    public static Id accountId{
       get{
        if(accountId != null) { return accountId; }
        String soql = 'SELECT Id FROM Account WHERE Name = \'Asset Account\' WITH SECURITY_ENFORCED LIMIT 1';
        List<Account> accList = Lib_Security.ws().dbQuery(soql, new Object[]{});
        if (accList.size() > 0) {
            accountId = accList[0].Id;
        } else {
            Account acc = new Account();
            acc.Name = 'Asset Account';
            Lib_Security.ws().dbInsert(new Account[]{acc});
            accountId = acc.Id;
        }
        return accountId;
       }
       set;
    }

    public static Id contactId{
        get{
            if(contactId != null) { return contactId;}
            String soql = 'SELECT Id, LastName FROM Contact WHERE LastName = \'Asset Contact\' WITH SECURITY_ENFORCED LIMIT 1';
        
            List<Contact> conList = Lib_Security.ws().dbQuery(soql, new Object[]{});
            if (conList.size() > 0) {
                contactId = conList[0].Id;
            } else {
                Contact con = new Contact();
                con.LastName = 'Asset Contact';
                con.AccountId = accountId;
                Lib_Security.ws().dbInsert(new Contact[]{con});
                contactId = con.Id;
            }
            return contactId;
        }
        set;
    }

    public AssetTriggerHandler(
        List<Equipment__c> newList,
        List<Equipment__c> oldList,
        Map<Id, Equipment__c> newMap,
        Map<Id, Equipment__c> oldMap,
        boolean isInsert,
        boolean isUpdate,
        Boolean isDelete,
        Boolean isUndelete
    ) {
        this.recordNewList = newList;
        this.recordOldList = oldList;
        this.recordNewMap = newMap;
        this.recordOldMap = oldMap;
        this.isInsert = isInsert;
        this.isUpdate = isUpdate;
        this.isDelete = isDelete;
        this.isUndelete = isUndelete;
    }
    
    public void BeforeInsertEvent() {
        updateAsset();
    }
    
    public void BeforeUpdateEvent() {
        updateAsset();
    }
    
    public void BeforeDeleteEvent() {
    }
    
    public void AfterInsertEvent() {
    }
    
    public void AfterUpdateEvent() {
    }
    
    public void AfterDeleteEvent() {
    }
    
    public void AfterUndeleteEvent() {
    }
    
    
    public void updateAsset() {
        for (Equipment__c a : recordNewList) {
            if (a.AccountId__c == null)
                a.AccountId__c = accountId;
            if (a.ContactId__c == null)
                a.ContactId__c = contactId;
        }
    }
}