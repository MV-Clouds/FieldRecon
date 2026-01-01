/**
* Class Name: ProposalLinesContainerController
* Test Class: ProposalLinesContainerControllerTest
* @description: Controller for Proposal Lines Container with Budget and Budget Lines
* Created Date: 31 Dec 2024
* Created By: Harsh Gandhi
* Modified Date: 1 Jan 2026
* Modified By: AI Assistant
*--------------------------------------------------------------------------------
* Modification History:
* Date Modified - Developer Name - Description
* 1 Jan 2026 - AI Assistant - Added comprehensive methods for proposal lines, budgets, and budget lines management
**/
public with sharing class ProposalLinesContainerController {
    
    private static final String CLASSNAME = 'ProposalLinesContainerController';

    /*
    *********************************************************
    @description     : Fetch Proposal Lines with Budgets and Budget Lines
    @param           : {String} proposalId - Proposal Record Id
    @return          : Map<String, Object> - Result with success status and data
    ********************************************************
    */
    @AuraEnabled
    public static Map<String, Object> getProposalLinesWithBudgets(String proposalId) {
        Map<String, Object> result = new Map<String, Object>();
        try {
            if (String.isBlank(proposalId)) {
                result.put('success', false);
                result.put('message', 'Proposal ID is required');
                result.put('data', new Map<String, Object>());
                return result;
            }
            
            // Fetch Proposal data
            wfrecon__Proposal__c proposal = [SELECT Id, Name, wfrecon__Proposal_Amount__c, wfrecon__Sales_Price__c, 
                wfrecon__OH_Amount__c, wfrecon__Warranty_Amount__c, wfrecon__Profit_Amount__c 
                FROM wfrecon__Proposal__c WHERE Id = :proposalId WITH USER_MODE LIMIT 1];
            
            // Fetch Proposal Lines
            List<wfrecon__Proposal_Line__c> proposalLines = [SELECT Id, Name, wfrecon__Description__c,
                    (SELECT Id, Name, wfrecon__Total_Budget__c, (SELECT Id, Name, wfrecon__Product__c, wfrecon__Product__r.Name, 
                        wfrecon__Price_Book__c, wfrecon__Price_Book__r.Name, wfrecon__Description__c, wfrecon__Quantity__c, wfrecon__Unit_Cost__c
                    FROM wfrecon__Budget_Lines__r ORDER BY CreatedDate ASC) FROM wfrecon__Budgets__r LIMIT 1) FROM wfrecon__Proposal_Line__c
                    WHERE wfrecon__Proposal__c = :proposalId WITH USER_MODE ORDER BY CreatedDate ASC];
            
            Map<String, Object> responseData = new Map<String, Object>();
            responseData.put('proposal', proposal);
            responseData.put('proposalLines', proposalLines);
            
            result.put('success', true);
            result.put('message', 'Proposal lines fetched successfully');
            result.put('data', responseData);
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{
                'className' => CLASSNAME,
                'methodName' => 'getProposalLinesWithBudgets',
                'isApiException' => false,
                'statusCode' => null,
                'exceptionObj' => e,
                'moreDetails' => 'Error fetching proposal lines for proposalId: ' + proposalId,
                'apiResponse' => null
            });
            result.put('success', false);
            result.put('message', 'Unable to load proposal lines. Please try again or contact your administrator.');
            result.put('error', e.getMessage());
            result.put('data', new Map<String, Object>());
        }
        return result;
    }

    /*
    *********************************************************
    @description     : Fetch Pricebooks
    @return          : Map<String, Object> - Result with success status and pricebooks
    ********************************************************
    */
    @AuraEnabled
    public static Map<String, Object> getPricebooks() {
        Map<String, Object> result = new Map<String, Object>();
        try {
            List<Pricebook2> pricebooks = [SELECT Id, Name FROM Pricebook2 WHERE IsActive = true WITH USER_MODE ORDER BY Name ASC];
            result.put('success', true);
            result.put('message', 'Pricebooks fetched successfully');
            result.put('data', pricebooks);
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{
                'className' => CLASSNAME,
                'methodName' => 'getPricebooks',
                'isApiException' => false,
                'statusCode' => null,
                'exceptionObj' => e,
                'moreDetails' => 'Error fetching pricebooks',
                'apiResponse' => null
            });
            result.put('success', false);
            result.put('message', 'Unable to load pricebooks. Please try again or contact your administrator.');
            result.put('error', e.getMessage());
            result.put('data', new List<Pricebook2>());
        }
        return result;
    }

    /*
    *********************************************************
    @description     : Fetch Products by Pricebook
    @param           : {String} pricebookId - Pricebook Id
    @return          : Map<String, Object> - Result with success status and products
    ********************************************************
    */
    @AuraEnabled
    public static Map<String, Object> getProductsByPricebook(String pricebookId) {
        Map<String, Object> result = new Map<String, Object>();
        try {
            if (String.isBlank(pricebookId)) {
                result.put('success', false);
                result.put('message', 'Pricebook ID is required');
                result.put('data', new List<PricebookEntry>());
                return result;
            }
            
            List<PricebookEntry> products = [SELECT Id, Product2Id, Product2.Name, UnitPrice FROM PricebookEntry WHERE Pricebook2Id = :pricebookId AND IsActive = true
                    WITH USER_MODE ORDER BY Product2.Name ASC];
            
            result.put('success', true);
            result.put('message', 'Products fetched successfully');
            result.put('data', products);
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{
                'className' => CLASSNAME,
                'methodName' => 'getProductsByPricebook',
                'isApiException' => false,
                'statusCode' => null,
                'exceptionObj' => e,
                'moreDetails' => 'Error fetching products for pricebookId: ' + pricebookId,
                'apiResponse' => null
            });
            result.put('success', false);
            result.put('message', 'Unable to load products. Please try again or contact your administrator.');
            result.put('error', e.getMessage());
            result.put('data', new List<PricebookEntry>());
        }
        return result;
    }

    /*
    *********************************************************
    @description     : Save Proposal Lines with Budgets and Budget Lines
    @param           : {String} linesData - JSON string of lines data
    @return          : Map<String, Object> - Result with success status and message
    ********************************************************
    */
    @AuraEnabled
    public static Map<String, Object> saveProposalLines(String linesData) {
        Map<String, Object> result = new Map<String, Object>();
        try {
            if (String.isBlank(linesData)) {
                result.put('success', false);
                result.put('message', 'No data provided to save');
                return result;
            }

            // Parse the data: one proposal line with multiple budget lines
            Map<String, Object> data = (Map<String, Object>) JSON.deserializeUntyped(linesData);
            
            // Create Proposal Line
            wfrecon__Proposal_Line__c proposalLine = new wfrecon__Proposal_Line__c();
            proposalLine.wfrecon__Proposal__c = (String) data.get('proposalId');
            proposalLine.Name = (String) data.get('proposalLineName');
            proposalLine.wfrecon__Description__c = (String) data.get('proposalLineDescription');
            
            insert as user proposalLine;

            // Create Budget
            wfrecon__Budget__c budget = new wfrecon__Budget__c();
            budget.wfrecon__Proposal_Line__c = proposalLine.Id;
            budget.Name = 'Budget for ' + proposalLine.Name;
            
            insert as user budget;

            // Create Budget Lines
            List<Object> budgetLinesData = (List<Object>) data.get('budgetLines');
            List<wfrecon__Budget_Line__c> budgetLinesToInsert = new List<wfrecon__Budget_Line__c>();
            
            for (Integer i = 0; i < budgetLinesData.size(); i++) {
                Map<String, Object> budgetLineMap = (Map<String, Object>) budgetLinesData[i];
                
                wfrecon__Budget_Line__c budgetLine = new wfrecon__Budget_Line__c();
                budgetLine.wfrecon__Budget__c = budget.Id;
                budgetLine.wfrecon__Product__c = (String) budgetLineMap.get('productId');
                budgetLine.wfrecon__Price_Book__c = (String) budgetLineMap.get('pricebookId');
                budgetLine.wfrecon__Quantity__c = (Decimal) budgetLineMap.get('quantity');
                budgetLine.wfrecon__Unit_Cost__c = (Decimal) budgetLineMap.get('unitCost');
                budgetLine.wfrecon__Description__c = (String) budgetLineMap.get('description');
                
                budgetLinesToInsert.add(budgetLine);
            }

            if (!budgetLinesToInsert.isEmpty()) {
                insert as user budgetLinesToInsert;
            }
            
            result.put('success', true);
            result.put('message', 'Proposal line and budget lines saved successfully');
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{
                'className' => CLASSNAME,
                'methodName' => 'saveProposalLines',
                'isApiException' => false,
                'statusCode' => null,
                'exceptionObj' => e,
                'moreDetails' => 'Error saving proposal lines',
                'apiResponse' => null
            });
            result.put('success', false);
            result.put('message', 'Unable to save proposal line. Please try again or contact your administrator.');
            result.put('error', e.getMessage());
        }
        return result;
    }

    /*
    *********************************************************
    @description     : Delete Proposal Line and Related Budget/Budget Lines
    @param           : {String} proposalLineId - Proposal Line Id
    @return          : Map<String, Object> - Result with success status and message
    ********************************************************
    */
    @AuraEnabled
    public static Map<String, Object> deleteProposalLine(String proposalLineId) {
        Map<String, Object> result = new Map<String, Object>();
        try {
            if (String.isBlank(proposalLineId)) {
                result.put('success', false);
                result.put('message', 'Proposal Line ID is required');
                return result;
            }

            // Query the proposal line with budgets
            List<wfrecon__Proposal_Line__c> proposalLines = [
                SELECT Id,
                    (SELECT Id FROM wfrecon__Budgets__r)
                FROM wfrecon__Proposal_Line__c
                WHERE Id = :proposalLineId
                WITH USER_MODE
                LIMIT 1
            ];

            if (proposalLines.isEmpty()) {
                result.put('success', false);
                result.put('message', 'Proposal line not found');
                return result;
            }

            wfrecon__Proposal_Line__c proposalLine = proposalLines[0];
            List<wfrecon__Budget__c> budgets = proposalLine.wfrecon__Budgets__r;

            // Delete budgets (budget lines will be deleted via cascade)
            if (!budgets.isEmpty()) {
                delete as user budgets;
            }

            // Delete proposal line
            delete as user proposalLine;
            
            result.put('success', true);
            result.put('message', 'Proposal line deleted successfully');
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{
                'className' => CLASSNAME,
                'methodName' => 'deleteProposalLine',
                'isApiException' => false,
                'statusCode' => null,
                'exceptionObj' => e,
                'moreDetails' => 'Error deleting proposal line with Id: ' + proposalLineId,
                'apiResponse' => null
            });
            result.put('success', false);
            result.put('message', 'Unable to delete proposal line. Please try again or contact your administrator.');
            result.put('error', e.getMessage());
        }
        return result;
    }

    /*
    *********************************************************
    @description     : Save Budget Line Inline Edits
    @param           : {String} budgetLinesJson - JSON string of budget lines with modifications
    @return          : Map<String, Object> - Result with success status and message
    ********************************************************
    */
    @AuraEnabled
    public static Map<String, Object> saveBudgetLineEdits(String budgetLinesJson) {
        Map<String, Object> result = new Map<String, Object>();
        try {
            if (String.isBlank(budgetLinesJson)) {
                result.put('success', false);
                result.put('message', 'No data provided to save');
                return result;
            }

            // Parse the budget lines data
            List<Object> budgetLinesData = (List<Object>) JSON.deserializeUntyped(budgetLinesJson);
            List<wfrecon__Budget_Line__c> budgetLinesToUpdate = new List<wfrecon__Budget_Line__c>();
            List<wfrecon__Budget_Line__c> budgetLinesToInsert = new List<wfrecon__Budget_Line__c>();
            List<Id> budgetLineIdsToDelete = new List<Id>();
            
            for (Object budgetLineObj : budgetLinesData) {
                Map<String, Object> budgetLineMap = (Map<String, Object>) budgetLineObj;
                String budgetLineId = (String) budgetLineMap.get('Id');
                String action = (String) budgetLineMap.get('action');
                
                if (action == 'delete' && String.isNotBlank(budgetLineId)) {
                    // Mark for deletion
                    budgetLineIdsToDelete.add(budgetLineId);
                } else if (action == 'insert') {
                    // New budget line
                    wfrecon__Budget_Line__c newBudgetLine = new wfrecon__Budget_Line__c();
                    newBudgetLine.wfrecon__Budget__c = (String) budgetLineMap.get('budgetId');
                    newBudgetLine.wfrecon__Product__c = (String) budgetLineMap.get('productId');
                    newBudgetLine.wfrecon__Price_Book__c = (String) budgetLineMap.get('pricebookId');
                    newBudgetLine.wfrecon__Quantity__c = (Decimal) budgetLineMap.get('quantity');
                    newBudgetLine.wfrecon__Unit_Cost__c = (Decimal) budgetLineMap.get('unitCost');
                    newBudgetLine.wfrecon__Description__c = (String) budgetLineMap.get('description');
                    budgetLinesToInsert.add(newBudgetLine);
                } else if (String.isNotBlank(budgetLineId)) {
                    // Update existing budget line
                    wfrecon__Budget_Line__c budgetLine = new wfrecon__Budget_Line__c();
                    budgetLine.Id = budgetLineId;
                    budgetLine.wfrecon__Quantity__c = (Decimal) budgetLineMap.get('quantity');
                    budgetLine.wfrecon__Unit_Cost__c = (Decimal) budgetLineMap.get('unitCost');
                    budgetLine.wfrecon__Description__c = (String) budgetLineMap.get('description');
                    budgetLinesToUpdate.add(budgetLine);
                }
            }

            // Perform DML operations
            if (!budgetLineIdsToDelete.isEmpty()) {
                delete as user [SELECT Id FROM wfrecon__Budget_Line__c WHERE Id IN :budgetLineIdsToDelete];
            }
            
            if (!budgetLinesToUpdate.isEmpty()) {
                update as user budgetLinesToUpdate;
            }
            
            if (!budgetLinesToInsert.isEmpty()) {
                insert as user budgetLinesToInsert;
            }
            
            result.put('success', true);
            result.put('message', 'Budget lines saved successfully');
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{
                'className' => CLASSNAME,
                'methodName' => 'saveBudgetLineEdits',
                'isApiException' => false,
                'statusCode' => null,
                'exceptionObj' => e,
                'moreDetails' => 'Error saving budget line edits',
                'apiResponse' => null
            });
            result.put('success', false);
            result.put('message', 'Unable to save budget lines. Please try again or contact your administrator.');
            result.put('error', e.getMessage());
        }
        return result;
    }

    /*
    *********************************************************
    @description     : Delete Budget Line
    @param           : {String} budgetLineId - Budget Line Id
    @return          : Map<String, Object> - Result with success status and message
    ********************************************************
    */
    @AuraEnabled
    public static Map<String, Object> deleteBudgetLine(String budgetLineId) {
        Map<String, Object> result = new Map<String, Object>();
        try {
            if (String.isBlank(budgetLineId)) {
                result.put('success', false);
                result.put('message', 'Budget Line ID is required');
                return result;
            }

            delete as user new wfrecon__Budget_Line__c(Id = budgetLineId);
            
            result.put('success', true);
            result.put('message', 'Budget line deleted successfully');
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{
                'className' => CLASSNAME,
                'methodName' => 'deleteBudgetLine',
                'isApiException' => false,
                'statusCode' => null,
                'exceptionObj' => e,
                'moreDetails' => 'Error deleting budget line with Id: ' + budgetLineId,
                'apiResponse' => null
            });
            result.put('success', false);
            result.put('message', 'Unable to delete budget line. Please try again or contact your administrator.');
            result.put('error', e.getMessage());
        }
        return result;
    }
}