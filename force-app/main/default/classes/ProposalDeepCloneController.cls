public with sharing class ProposalDeepCloneController {

    // Cache schema descriptions to save CPU time
    private static Map<String, Set<String>> cachedFieldMap = new Map<String, Set<String>>();

    @AuraEnabled
    public static String cloneProposal(Id proposalId) {
        Savepoint sp = Database.setSavepoint();
        try {
            // ----------------------------------------------------------------
            // 1. CLONE ROOT (Proposal)
            // ----------------------------------------------------------------
            String rootObjName = 'wfrecon__Proposal__c';
            
            // Query & Clone Parent
            SObject originalProposal = querySingleRecord(proposalId, rootObjName);
            SObject newProposal = originalProposal.clone(false, true, false, false);
            
            // Name Logic: Only update Name if it is NOT an Auto-Number
            if (isNameWritable(rootObjName)) {
                String oldName = (String)originalProposal.get('Name');
                newProposal.put('Name', oldName + ' - Clone');
            }
            insert newProposal;

            // ----------------------------------------------------------------
            // 2. RECURSIVE DEEP CLONE (Levels 1, 2, 3)
            // ----------------------------------------------------------------
            // Map maintains the link: Old_Parent_ID => New_Parent_Record
            Map<Id, SObject> previousLevelMap = new Map<Id, SObject>{ proposalId => newProposal };

            // Run for 3 levels deep
            for (Integer i = 1; i <= 3; i++) {
                // Stop if we are close to limits
                if (Limits.getQueries() >= 90) break;

                previousLevelMap = processLevel(previousLevelMap);

                if (previousLevelMap.isEmpty()) break;
            }

            return newProposal.Id;

        } catch (Exception e) {
            Database.rollback(sp);
            throw new AuraHandledException('Deep Clone Error: ' + e.getMessage() + ' | ' + e.getStackTraceString());
        }
    }

    /**
     * PROCESS LEVEL: 
     * Uses Sub-Select Queries to fetch children of multiple types in batches.
     */
    private static Map<Id, SObject> processLevel(Map<Id, SObject> parentMap) {
        Map<Id, SObject> nextLevelMap = new Map<Id, SObject>();
        
        // 1. Group Parent IDs by SObject Type (Handle recursive parents)
        Map<String, Set<Id>> parentIdsByType = new Map<String, Set<Id>>();
        for (Id oldId : parentMap.keySet()) {
            String objType = String.valueOf(oldId.getSobjectType());
            if (!parentIdsByType.containsKey(objType)) {
                parentIdsByType.put(objType, new Set<Id>());
            }
            parentIdsByType.get(objType).add(oldId);
        }

        // We will collect all new records here before inserting
        // Map<ObjectTypeName, List<Records>>
        Map<String, List<SObject>> newRecordsToInsertByType = new Map<String, List<SObject>>();
        
        // Tracking: Old_Child_ID => New_Child_Record (for next recursion)
        Map<Id, SObject> oldIdToNewInstance = new Map<Id, SObject>();

        // 2. Iterate Parent Types
        for (String parentObjName : parentIdsByType.keySet()) {
            Set<Id> validParentIds = parentIdsByType.get(parentObjName);
            
            // Get all Custom Relationships
            List<ChildRelationInfo> relations = getChildRelationships(parentObjName);
            if (relations.isEmpty()) continue;

            // 3. CHUNK LOGIC (Batching Sub-Queries)
            // Salesforce allows max 20 sub-queries per SOQL. We use 15 to be safe and avoid query length limits.
            Integer BATCH_SIZE = 15;
            
            for (Integer i = 0; i < relations.size(); i += BATCH_SIZE) {
                // Safety: Stop if query limits hit
                if (Limits.getQueries() >= 95) break;

                // Create a batch of relationships
                List<ChildRelationInfo> batchRels = new List<ChildRelationInfo>();
                for (Integer j = 0; j < BATCH_SIZE && (i + j) < relations.size(); j++) {
                    batchRels.add(relations[i + j]);
                }

                // Build Sub-Select Query: SELECT Id, (SELECT ... FROM Rel1), (SELECT ... FROM Rel2) FROM Parent
                List<String> subSelects = new List<String>();
                
                // Keep track of which relationship maps to which index/name
                for (ChildRelationInfo rel : batchRels) {
                    Set<String> fields = getCloneableFields(rel.childObjectName);
                    if (fields.isEmpty()) continue;
                    
                    String subQuery = '(SELECT ' + String.join(new List<String>(fields), ',') + 
                                      ' FROM ' + rel.relationshipName + ')';
                    subSelects.add(subQuery);
                }

                if (subSelects.isEmpty()) continue;

                String masterQuery = 'SELECT Id, ' + String.join(subSelects, ',') + 
                                     ' FROM ' + parentObjName + 
                                     ' WHERE Id IN :validParentIds';

                // Execute ONE query for up to 15 Child Objects
                List<SObject> queryResults = Database.query(masterQuery);

                // 4. Extract Children from Results
                for (SObject parentRecord : queryResults) {
                    SObject newParent = parentMap.get(parentRecord.Id); // Get the NEW parent we created earlier

                    for (ChildRelationInfo rel : batchRels) {
                        // Extract embedded list
                        // Using safe extraction
                        List<SObject> children = new List<SObject>();
                        try {
                            children = parentRecord.getSObjects(rel.relationshipName);
                        } catch (Exception ex) { continue; } // Handle cases where relationship returns null

                        if (children != null && !children.isEmpty()) {
                            List<SObject> clonesForThisRel = new List<SObject>();
                            
                            for (SObject oldChild : children) {
                                SObject newChild = oldChild.clone(false, true, false, false);
                                
                                // Re-Parent
                                newChild.put(rel.lookupFieldName, newParent.Id);
                                
                                clonesForThisRel.add(newChild);
                                oldIdToNewInstance.put(oldChild.Id, newChild);
                            }

                            if (!newRecordsToInsertByType.containsKey(rel.childObjectName)) {
                                newRecordsToInsertByType.put(rel.childObjectName, new List<SObject>());
                            }
                            newRecordsToInsertByType.get(rel.childObjectName).addAll(clonesForThisRel);
                        }
                    }
                }
            }
        }

        // 5. BULK INSERT (One DML per Object Type)
        if (!newRecordsToInsertByType.isEmpty()) {
            for (String objType : newRecordsToInsertByType.keySet()) {
                try {
                    insert newRecordsToInsertByType.get(objType);
                } catch (Exception e) {
                    System.debug('Error inserting ' + objType + ': ' + e.getMessage());
                }
            }
        }

        // 6. Return Map for Next Level
        for (Id oldId : oldIdToNewInstance.keySet()) {
            SObject newRec = oldIdToNewInstance.get(oldId);
            if (newRec.Id != null) {
                nextLevelMap.put(oldId, newRec);
            }
        }

        return nextLevelMap;
    }

    // ----------------------------------------------------------------
    // UTILITIES
    // ----------------------------------------------------------------

    private static SObject querySingleRecord(Id recordId, String objectName) {
        Set<String> fields = getCloneableFields(objectName);
        String query = 'SELECT ' + String.join(new List<String>(fields), ',') + 
                       ' FROM ' + objectName + ' WHERE Id = :recordId LIMIT 1';
        return Database.query(query);
    }

    private static Boolean isNameWritable(String objectName) {
        Map<String, Schema.SObjectField> mapFields = Schema.getGlobalDescribe().get(objectName).getDescribe().fields.getMap();
        if (mapFields.containsKey('Name')) {
            Schema.DescribeFieldResult d = mapFields.get('Name').getDescribe();
            return d.isCreateable() && !d.isAutoNumber();
        }
        return false;
    }

    // --- SCHEMA METHODS ---

    private static Set<String> getCloneableFields(String objectName) {
        if (cachedFieldMap.containsKey(objectName)) {
            return cachedFieldMap.get(objectName);
        }

        Set<String> fieldsToQuery = new Set<String>();
        Map<String, Schema.SObjectField> fieldMap = Schema.getGlobalDescribe().get(objectName).getDescribe().fields.getMap();

        for (String fieldName : fieldMap.keySet()) {
            Schema.DescribeFieldResult d = fieldMap.get(fieldName).getDescribe();
            
            // Exclude System Fields
            if (d.getName().equalsIgnoreCase('ActivityId')) continue; 
            if (d.getName().equalsIgnoreCase('CreatedDate')) continue; 
            if (d.getName().equalsIgnoreCase('LastModifiedDate')) continue; 
            if (d.getName().equalsIgnoreCase('OwnerId') && !d.isCreateable()) continue; 

            if (d.getName() == 'Name' || d.isCreateable()) {
                fieldsToQuery.add(d.getName());
            }
        }
        cachedFieldMap.put(objectName, fieldsToQuery);
        return fieldsToQuery;
    }

    public class ChildRelationInfo {
        public String childObjectName;
        public String lookupFieldName;
        public String relationshipName; // e.g. wfrecon__Proposal_Items__r
    }

    private static List<ChildRelationInfo> getChildRelationships(String parentObjectName) {
        List<ChildRelationInfo> relationships = new List<ChildRelationInfo>();
        
        Schema.SObjectType parentType = Schema.getGlobalDescribe().get(parentObjectName);
        if (parentType == null) return relationships;

        for (Schema.ChildRelationship rel : parentType.getDescribe().getChildRelationships()) {
            Schema.DescribeSObjectResult childDescribe = rel.getChildSObject().getDescribe();
            String childName = childDescribe.getName();
            String relName = rel.getRelationshipName(); // Essential for Sub-Query

            // FILTER: 
            // 1. Must be Custom Object (avoids system tables)
            // 2. Must be Createable
            // 3. Must have a Relationship Name (some system relationships don't)
            if (relName != null && childDescribe.isCustom() && childDescribe.isCreateable()) {
                
                ChildRelationInfo info = new ChildRelationInfo();
                info.childObjectName = childName;
                info.lookupFieldName = rel.getField().getDescribe().getName();
                info.relationshipName = relName;
                relationships.add(info);
            }
        }
        return relationships;
    }
}