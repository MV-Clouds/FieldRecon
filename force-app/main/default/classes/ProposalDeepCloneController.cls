public with sharing class ProposalDeepCloneController {

    @AuraEnabled
    public static String cloneProposal(Id proposalId) {
        Savepoint sp = Database.setSavepoint();
        try {
            System.debug('### STARTING CLONE FOR PROPOSAL: ' + proposalId);

            // ====================================================
            // 1. CLONE PROPOSAL
            // ====================================================
            SObject oldProposal = queryRecord('wfrecon__Proposal__c', 'Id', new Set<Id>{proposalId}).get(0);
            SObject newProposal = oldProposal.clone(false, true, false, false);
            
            // Set Name
            if (isNameWritable('wfrecon__Proposal__c')) {
                newProposal.put('Name', (String)oldProposal.get('Name') + ' - Clone');
            }
            insert newProposal;
            Id newProposalId = newProposal.Id;
            
            List<SObject> oldLines = queryRecord('wfrecon__Proposal_Line__c', 'wfrecon__Proposal__c', new Set<Id>{proposalId});
            System.debug('### FOUND LINES: ' + oldLines.size());

            Map<Id, Id> oldLineIdToNewLineId = new Map<Id, Id>();

            if (!oldLines.isEmpty()) {
                List<SObject> newLines = new List<SObject>();
                
                for (SObject oldRec : oldLines) {
                    SObject newRec = oldRec.clone(false, true, false, false);
                    newRec.put('wfrecon__Proposal__c', newProposalId); // Link to New Proposal
                    newLines.add(newRec);
                }
                
                insert newLines;

                // Map Old IDs to New IDs
                for (Integer i = 0; i < oldLines.size(); i++) {
                    oldLineIdToNewLineId.put(oldLines[i].Id, newLines[i].Id);
                }
            }


            // ====================================================
            // 3. CLONE BUDGETS
            // ====================================================
            // We query budgets that are linked to the OLD Lines
            if (!oldLineIdToNewLineId.isEmpty()) {
                List<SObject> oldBudgets = queryRecord('wfrecon__Budget__c', 'wfrecon__Proposal_Line__c', oldLineIdToNewLineId.keySet());
                System.debug('### FOUND BUDGETS: ' + oldBudgets.size());

                Map<Id, Id> oldBudgetIdToNewBudgetId = new Map<Id, Id>();

                if (!oldBudgets.isEmpty()) {
                    List<SObject> newBudgets = new List<SObject>();

                    for (SObject oldRec : oldBudgets) {
                        SObject newRec = oldRec.clone(false, true, false, false);
                        
                        // 1. Link to New Line
                        Id oldLineId = (Id)oldRec.get('wfrecon__Proposal_Line__c');
                        if (oldLineIdToNewLineId.containsKey(oldLineId)) {
                            newRec.put('wfrecon__Proposal_Line__c', oldLineIdToNewLineId.get(oldLineId));
                        }

                        // 2. Link to New Proposal (Crucial Fix)
                        // Even if Budget is child of Line, it often has a lookup to Proposal too. 
                        // We must update this, otherwise it points to Old Proposal.
                        if (hasField('wfrecon__Budget__c', 'wfrecon__Proposal__c')) {
                            newRec.put('wfrecon__Proposal__c', newProposalId);
                        }

                        newBudgets.add(newRec);
                    }

                    insert newBudgets;

                    // Map Old IDs to New IDs
                    for (Integer i = 0; i < oldBudgets.size(); i++) {
                        oldBudgetIdToNewBudgetId.put(oldBudgets[i].Id, newBudgets[i].Id);
                    }
                }


                // ====================================================
                // 4. CLONE BUDGET LINES
                // ====================================================
                if (!oldBudgetIdToNewBudgetId.isEmpty()) {
                    List<SObject> oldBudgetLines = queryRecord('wfrecon__Budget_Line__c', 'wfrecon__Budget__c', oldBudgetIdToNewBudgetId.keySet());
                    System.debug('### FOUND BUDGET LINES: ' + oldBudgetLines.size());

                    if (!oldBudgetLines.isEmpty()) {
                        List<SObject> newBudgetLines = new List<SObject>();

                        for (SObject oldRec : oldBudgetLines) {
                            SObject newRec = oldRec.clone(false, true, false, false);
                            
                            // 1. Link to New Budget
                            Id oldBudgetId = (Id)oldRec.get('wfrecon__Budget__c');
                            if (oldBudgetIdToNewBudgetId.containsKey(oldBudgetId)) {
                                newRec.put('wfrecon__Budget__c', oldBudgetIdToNewBudgetId.get(oldBudgetId));
                            }

                            // 2. Link to New Proposal (Safety Fix)
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
            Database.rollback(sp);
            System.debug('### EXCEPTION: ' + e.getMessage());
            System.debug('### STACK: ' + e.getStackTraceString());
            throw new AuraHandledException('Error: ' + e.getMessage());
        }
    }

    // ==========================================================================
    // HELPER METHODS
    // ==========================================================================

    private static List<SObject> queryRecord(String objName, String criteriaField, Set<Id> criteriaValues) {
        if (criteriaValues.isEmpty()) return new List<SObject>();
        
        List<String> fields = getFields(objName);
        
        // Ensure criteria field is selected so we can map it later
        Boolean hasField = false;
        for(String f : fields) { if(f.equalsIgnoreCase(criteriaField)) hasField=true; }
        if(!hasField) fields.add(criteriaField);

        String query = 'SELECT ' + String.join(fields, ',') + 
                       ' FROM ' + objName + 
                       ' WHERE ' + criteriaField + ' IN :criteriaValues';
        
        return Database.query(query);
    }

    private static List<String> getFields(String objName) {
        Map<String, Schema.SObjectField> fieldMap = Schema.getGlobalDescribe().get(objName).getDescribe().fields.getMap();
        List<String> fields = new List<String>();
        
        for (String f : fieldMap.keySet()) {
            Schema.DescribeFieldResult d = fieldMap.get(f).getDescribe();
            // Get all Accessible fields
            if (d.isAccessible()) {
                // Exclude system fields that break clones
                String n = d.getName();
                if (!n.equalsIgnoreCase('CreatedDate') && 
                    !n.equalsIgnoreCase('LastModifiedDate') &&
                    !n.equalsIgnoreCase('CreatedById') &&
                    !n.equalsIgnoreCase('LastModifiedById')) {
                    fields.add(n);
                }
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