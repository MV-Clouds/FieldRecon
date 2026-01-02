/**
* Class Name: ProposalDeepCloneController
* @description: Controller for deep cloning Proposals, Proposal Lines, Budgets, and Budget Lines.
* Created Date: 02 January 2026
**/
public with sharing class ProposalDeepCloneController {

    /**
     * @description: Deep clones a Proposal and its related children (Lines, Budgets, Budget Lines)
     * @param proposalId: The Id of the original Proposal record
     * @return: String - The Id of the newly created Proposal, or null if failed
     */
    @AuraEnabled
    public static String cloneProposal(Id proposalId) {
        // Set savepoint to rollback changes if any error occurs
        Savepoint sp = Database.setSavepoint();
        
        try {
            // ====================================================
            // 1. CLONE PROPOSAL
            // ====================================================
            List<SObject> existingProposals = queryRecord('wfrecon__Proposal__c', 'Id', new Set<Id>{proposalId});
            if (existingProposals.isEmpty()) {
                // Manually throw exception to jump to catch block
                throw new CalloutException('Original Proposal not found.');
            }
            
            SObject oldProposal = existingProposals.get(0);
            SObject newProposal = oldProposal.clone(false, true, false, false);
            
            // Set Name
            if (isNameWritable('wfrecon__Proposal__c')) {
                newProposal.put('Name', (String)oldProposal.get('Name') + ' - Clone');
            }
            insert newProposal;
            Id newProposalId = newProposal.Id;
            
            // ====================================================
            // 2. CLONE PROPOSAL LINES
            // ====================================================
            List<SObject> oldLines = queryRecord('wfrecon__Proposal_Line__c', 'wfrecon__Proposal__c', new Set<Id>{proposalId});
            Map<Id, Id> oldLineIdToNewLineId = new Map<Id, Id>();

            if (!oldLines.isEmpty()) {
                List<SObject> newLines = new List<SObject>();
                
                for (SObject oldRec : oldLines) {
                    SObject newRec = oldRec.clone(false, true, false, false);
                    newRec.put('wfrecon__Proposal__c', newProposalId);
                    newLines.add(newRec);
                }
                
                insert newLines;

                for (Integer i = 0; i < oldLines.size(); i++) {
                    oldLineIdToNewLineId.put(oldLines[i].Id, newLines[i].Id);
                }
            }

            // ====================================================
            // 3. CLONE BUDGETS
            // ====================================================
            if (!oldLineIdToNewLineId.isEmpty()) {
                List<SObject> oldBudgets = queryRecord('wfrecon__Budget__c', 'wfrecon__Proposal_Line__c', oldLineIdToNewLineId.keySet());
                Map<Id, Id> oldBudgetIdToNewBudgetId = new Map<Id, Id>();

                if (!oldBudgets.isEmpty()) {
                    List<SObject> newBudgets = new List<SObject>();

                    for (SObject oldRec : oldBudgets) {
                        SObject newRec = oldRec.clone(false, true, false, false);
                        
                        Id oldLineId = (Id)oldRec.get('wfrecon__Proposal_Line__c');
                        if (oldLineIdToNewLineId.containsKey(oldLineId)) {
                            newRec.put('wfrecon__Proposal_Line__c', oldLineIdToNewLineId.get(oldLineId));
                        }

                        if (hasField('wfrecon__Budget__c', 'wfrecon__Proposal__c')) {
                            newRec.put('wfrecon__Proposal__c', newProposalId);
                        }

                        newBudgets.add(newRec);
                    }

                    insert newBudgets;

                    for (Integer i = 0; i < oldBudgets.size(); i++) {
                        oldBudgetIdToNewBudgetId.put(oldBudgets[i].Id, newBudgets[i].Id);
                    }
                }

                // ====================================================
                // 4. CLONE BUDGET LINES
                // ====================================================
                if (!oldBudgetIdToNewBudgetId.isEmpty()) {
                    List<SObject> oldBudgetLines = queryRecord('wfrecon__Budget_Line__c', 'wfrecon__Budget__c', oldBudgetIdToNewBudgetId.keySet());

                    if (!oldBudgetLines.isEmpty()) {
                        List<SObject> newBudgetLines = new List<SObject>();

                        for (SObject oldRec : oldBudgetLines) {
                            SObject newRec = oldRec.clone(false, true, false, false);
                            
                            Id oldBudgetId = (Id)oldRec.get('wfrecon__Budget__c');
                            if (oldBudgetIdToNewBudgetId.containsKey(oldBudgetId)) {
                                newRec.put('wfrecon__Budget__c', oldBudgetIdToNewBudgetId.get(oldBudgetId));
                            }

                            if (hasField('wfrecon__Budget_Line__c', 'wfrecon__Proposal__c')) {
                                newRec.put('wfrecon__Proposal__c', newProposalId);
                            }

                            newBudgetLines.add(newRec);
                        }
                        insert newBudgetLines;
                    }
                }
            }

            return newProposalId;

        } catch (Exception e) {
            // 1. Rollback changes so no partial data is saved
            Database.rollback(sp);
            
            // 2. Log the exception
            ExceptionHandler.logException(new Map<String, Object>{
                'className' => 'ProposalDeepCloneController',
                'methodName' => 'cloneProposal',
                'exceptionObj' => e,
                'moreDetails' => e.getMessage()
            });
            
            return null;
        }
    }

    
    private static List<SObject> queryRecord(String objName, String criteriaField, Set<Id> criteriaValues) {
        if (criteriaValues.isEmpty()) return new List<SObject>();
        
        List<String> fields = getFields(objName);
        
        // Ensure criteria field is selected so we can map it later
        Boolean hasField = false;
        for(String f : fields) { if(f.equalsIgnoreCase(criteriaField)) hasField=true; }
        if(!hasField) fields.add(criteriaField);
        
        String query = 'SELECT ' + String.join(fields, ',') + ' FROM ' + objName + ' WHERE ' + criteriaField + ' IN :criteriaValues';
        return Database.query(query);
    }

    private static List<String> getFields(String objName) {
        Map<String, Schema.SObjectField> fieldMap = Schema.getGlobalDescribe().get(objName).getDescribe().fields.getMap();
        List<String> fields = new List<String>();
        
        for (String f : fieldMap.keySet()) {
            Schema.DescribeFieldResult d = fieldMap.get(f).getDescribe();
            if (d.isAccessible() && !d.getName().equalsIgnoreCase('CreatedDate') && 
                !d.getName().equalsIgnoreCase('LastModifiedDate') &&
                !d.getName().equalsIgnoreCase('CreatedById') &&
                !d.getName().equalsIgnoreCase('LastModifiedById')) {
                    fields.add(d.getName());
            }
        }
        return fields;
    }

    private static Boolean isNameWritable(String objName) {
        Schema.DescribeFieldResult d = Schema.getGlobalDescribe().get(objName).getDescribe().fields.getMap().get('Name').getDescribe();
        return d.isCreateable() && !d.isAutoNumber();
    }

    private static Boolean hasField(String objName, String fieldName) {
        return Schema.getGlobalDescribe().get(objName).getDescribe().fields.getMap().containsKey(fieldName);
    }
}