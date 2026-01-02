public with sharing class ProposalDeepCloneController {

    @AuraEnabled
    public static String cloneProposal(Id proposalId) {
        Savepoint sp = Database.setSavepoint();
        try {
            // ----------------------------------------------------------------
            // 1. CLONE ROOT (Proposal)
            // ----------------------------------------------------------------
            String rootObjName = 'wfrecon__Proposal__c';
            SObject originalProposal = querySingleRecord(proposalId, rootObjName);
            SObject newProposal = cloneSingleRecord(originalProposal, rootObjName);
            
            // Optional: Append ' - Clone' to Name
            if (hasField(rootObjName, 'Name')) {
                newProposal.put('Name', (String)originalProposal.get('Name') + ' - Clone');
            }
            
            insert newProposal;

            // ----------------------------------------------------------------
            // 2. PROCESS LEVELS (Level 1 > Level 2 > Level 3)
            // ----------------------------------------------------------------
            // We maintain a map of { Old_ID => New_Record } to allow reparenting
            Map<Id, SObject> previousLevelMap = new Map<Id, SObject>{ proposalId => newProposal };

            // Loop 3 times to go 3 levels deep:
            // 1: Proposal -> Children
            // 2: Children -> GrandChildren
            // 3: GrandChildren -> GreatGrandChildren
            for (Integer level = 1; level <= 3; level++) {
                // Pass the map of the previous level (parents) to find and clone their children
                previousLevelMap = processLevel(previousLevelMap);
                
                // If no records found at this level, stop deeper processing
                if (previousLevelMap.isEmpty()) {
                    break;
                }
            }

            return newProposal.Id;

        } catch (Exception e) {
            Database.rollback(sp);
            throw new AuraHandledException('Deep Clone Error: ' + e.getMessage() + ' | ' + e.getStackTraceString());
        }
    }

    /**
     * CORE ENGINE: Takes a map of Parents, finds ALL valid children, clones them, and inserts them.
     * Returns a map of the NEW children to be used as parents for the next level.
     */
    private static Map<Id, SObject> processLevel(Map<Id, SObject> parentMap) {
        Map<Id, SObject> nextLevelMap = new Map<Id, SObject>();
        
        // 1. Group Parent IDs by SObject Type 
        // (Because Level 1 might have mixed types, e.g., Proposal_Item__c AND Attachment__c)
        Map<String, Set<Id>> parentIdsByType = new Map<String, Set<Id>>();
        
        for (Id oldId : parentMap.keySet()) {
            String objType = String.valueOf(oldId.getSobjectType());
            if (!parentIdsByType.containsKey(objType)) {
                parentIdsByType.put(objType, new Set<Id>());
            }
            parentIdsByType.get(objType).add(oldId);
        }

        // Holder for all new records to be inserted, grouped by THEIR object type
        Map<String, List<SObject>> newRecordsToInsertByType = new Map<String, List<SObject>>();
        // Temporary mapping to track lineage before insert
        Map<SObject, Id> newRecordToOldParentId = new Map<SObject, Id>();
        // Temporary mapping to track Old ID to New Instance
        Map<Id, SObject> oldIdToNewInstance = new Map<Id, SObject>();

        // 2. Discover and Clone Children for each Parent Type
        for (String parentObjName : parentIdsByType.keySet()) {
            Set<Id> validParentIds = parentIdsByType.get(parentObjName);
            
            // Get all child relationships for this parent object type
            List<ChildRelationInfo> relations = getChildRelationships(parentObjName);

            for (ChildRelationInfo rel : relations) {
                // Dynamic Query for this specific child object
                Set<String> queryFields = getCloneableFields(rel.childObjectName);
                if (queryFields.isEmpty()) continue;

                String query = 'SELECT ' + String.join(new List<String>(queryFields), ',') + 
                               ' FROM ' + rel.childObjectName + 
                               ' WHERE ' + rel.lookupFieldName + ' IN :validParentIds';

                // Query records
                List<SObject> originalRecords = Database.query(query);

                if (!originalRecords.isEmpty()) {
                    List<SObject> clonesForThisType = new List<SObject>();

                    for (SObject oldRecord : originalRecords) {
                        SObject newRecord = oldRecord.clone(false, true, false, false);
                        
                        // RE-PARENTING LOGIC
                        Id oldParentId = (Id)oldRecord.get(rel.lookupFieldName);
                        SObject newParent = parentMap.get(oldParentId);
                        
                        if (newParent != null) {
                            newRecord.put(rel.lookupFieldName, newParent.Id);
                            clonesForThisType.add(newRecord);
                            
                            // Track mapping for next level
                            oldIdToNewInstance.put(oldRecord.Id, newRecord);
                        }
                    }

                    if (!clonesForThisType.isEmpty()) {
                        if (!newRecordsToInsertByType.containsKey(rel.childObjectName)) {
                            newRecordsToInsertByType.put(rel.childObjectName, new List<SObject>());
                        }
                        newRecordsToInsertByType.get(rel.childObjectName).addAll(clonesForThisType);
                    }
                }
            }
        }

        // 3. BULK INSERT (Grouped by Type to minimize chunks and DML)
        if (!newRecordsToInsertByType.isEmpty()) {
            for (String objType : newRecordsToInsertByType.keySet()) {
                // Performs 1 DML per Object Type
                insert newRecordsToInsertByType.get(objType);
            }
        }

        // 4. Return the map of Old_ID -> New_SObject (with ID) for the next recursion level
        // We filter oldIdToNewInstance to only include those that were actually inserted
        for (Id oldId : oldIdToNewInstance.keySet()) {
            SObject newRec = oldIdToNewInstance.get(oldId);
            if (newRec.Id != null) {
                nextLevelMap.put(oldId, newRec);
            }
        }

        return nextLevelMap;
    }


    // ----------------------------------------------------------------
    // HELPER METHODS
    // ----------------------------------------------------------------

    private static SObject querySingleRecord(Id recordId, String objectName) {
        Set<String> fields = getCloneableFields(objectName);
        String query = 'SELECT ' + String.join(new List<String>(fields), ',') + 
                       ' FROM ' + objectName + ' WHERE Id = :recordId LIMIT 1';
        return Database.query(query);
    }

    private static SObject cloneSingleRecord(SObject original, String objectName) {
        return original.clone(false, true, false, false);
    }

    private static Boolean hasField(String objectName, String fieldName) {
        Map<String, Schema.SObjectField> mapFields = Schema.getGlobalDescribe().get(objectName).getDescribe().fields.getMap();
        return mapFields.containsKey(fieldName);
    }

    // --- SCHEMA DISCOVERY ---

    private static Set<String> getCloneableFields(String objectName) {
        Set<String> fieldsToQuery = new Set<String>();
        Map<String, Schema.SObjectField> fieldMap = Schema.getGlobalDescribe().get(objectName).getDescribe().fields.getMap();

        for (String fieldName : fieldMap.keySet()) {
            Schema.DescribeFieldResult d = fieldMap.get(fieldName).getDescribe();
            
            // Explicitly exclude system fields that cause clone errors
            if (d.getName().equalsIgnoreCase('ActivityId')) continue; 
            if (d.getName().equalsIgnoreCase('CreatedDate')) continue; 
            if (d.getName().equalsIgnoreCase('LastModifiedDate')) continue; 
            if (d.getName().equalsIgnoreCase('OwnerId') && !d.isCreateable()) continue; // OwnerId is tricky on some detail objects

            // Logic: Include 'Name' always. Include Custom Fields. Include Createable Standard Fields.
            if (d.getName() == 'Name' || d.isCreateable()) {
                fieldsToQuery.add(d.getName());
            }
        }
        return fieldsToQuery;
    }

    public class ChildRelationInfo {
        public String childObjectName;
        public String lookupFieldName;
    }

    private static List<ChildRelationInfo> getChildRelationships(String parentObjectName) {
        List<ChildRelationInfo> relationships = new List<ChildRelationInfo>();
        
        Schema.SObjectType parentType = Schema.getGlobalDescribe().get(parentObjectName);
        if (parentType == null) return relationships;

        Schema.DescribeSObjectResult describe = parentType.getDescribe();

        for (Schema.ChildRelationship rel : describe.getChildRelationships()) {
            Schema.DescribeSObjectResult childDescribe = rel.getChildSObject().getDescribe();
            String childName = childDescribe.getName();

            // --- ROBUST FILTER LOGIC ---
            // 1. Must be Createable
            // 2. Exclude System/Problematic Objects
            if (childDescribe.isCreateable() && 
               !childName.endsWith('History') && 
               !childName.endsWith('Share') && 
               !childName.endsWith('Feed') &&
               !childName.equalsIgnoreCase('Task') && 
               !childName.equalsIgnoreCase('Event') &&
               !childName.equalsIgnoreCase('EmailMessage') &&
               !childName.equalsIgnoreCase('Note') && // Notes (classic) often cause issues, ContentDocument is preferred
               !childName.equalsIgnoreCase('ProcessInstance') &&
               !childName.equalsIgnoreCase('ContentDocumentLink')) {
                
                ChildRelationInfo info = new ChildRelationInfo();
                info.childObjectName = childName;
                info.lookupFieldName = rel.getField().getDescribe().getName();
                relationships.add(info);
            }
        }
        return relationships;
    }
}