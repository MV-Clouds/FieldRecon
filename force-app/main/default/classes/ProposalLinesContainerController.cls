/**
* Class Name: ProposalLinesContainerController
* Test Class: ProposalLinesContainerControllerTest
* @description: Controller for Proposal Lines Container with Budget and Budget Lines
* Created Date: 31 Dec 2024
* Created By: Harsh Gandhi
* Modified Date: 1 Jan 2026
* Modified By: Karan Singh
*--------------------------------------------------------------------------------
* Modification History:
* Date Modified - Developer Name - Description
* 1 Jan 2026 - Karan Singh - Added comprehensive methods for proposal lines, budgets, and budget lines management
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
            
            // Fetch Proposal Lines with Budget information
            List<wfrecon__Proposal_Line__c> proposalLines = [
                SELECT Id, Name, wfrecon__Product__c, wfrecon__Total_Cost__c, wfrecon__Description__c,
                    wfrecon__Quantity__c, wfrecon__OH_Per__c, wfrecon__Warranty_Per__c, wfrecon__Profit_Per__c,
                    wfrecon__OH_Amount__c, wfrecon__Profit_Amount__c, wfrecon__Warranty_Amount__c, 
                    wfrecon__Recommended_Price__c, wfrecon__Sales_Price__c,
                    wfrecon__Hotel_Cost__c, wfrecon__Labor_Cost__c, wfrecon__Material_Cost__c, 
                    wfrecon__Mileage_Cost__c, wfrecon__Per_Diem_Cost__c,
                    (SELECT Id, Name, 
                        (SELECT Id, Name, wfrecon__Cost_Type__c,
                            wfrecon__No_Of_Crew_Members__c, wfrecon__Hrs_day__c, wfrecon__Burden_Rate_Hour__c, wfrecon__Total_Mileage__c,
                            wfrecon__of_Days__c, wfrecon__Note__c, wfrecon__Labor_Cost__c, wfrecon__Material_Cost__c,
                            wfrecon__Material__c, wfrecon__QTY__c, wfrecon__Cost_Each__c, wfrecon__Estimated_Hours__c,
                            wfrecon__Of_Nights__c, wfrecon__Number_Of_Rooms__c, wfrecon__Costs_Per_Night__c, wfrecon__Total_Hotel_Cost__c,
                            wfrecon__Of_Trips__c, wfrecon__Of_Trucks__c, wfrecon__Mileage__c, wfrecon__Mileage_Rate__c,
                            wfrecon__Per_Diem_of_Days__c, wfrecon__Per_Diem_Rate__c, wfrecon__of_Men__c, wfrecon__Total_Per_Diem__c
                        FROM wfrecon__Budget_Lines__r 
                        ORDER BY CreatedDate ASC) 
                    FROM wfrecon__Budgets__r 
                    LIMIT 1) 
                FROM wfrecon__Proposal_Line__c
                WHERE wfrecon__Proposal__c = :proposalId 
                WITH USER_MODE 
                ORDER BY CreatedDate ASC
            ];
            
            Map<String, Object> responseData = new Map<String, Object>();
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
            
            List<PricebookEntry> products = [SELECT Id, Product2Id, Product2.Name, Product2.Description, UnitPrice FROM PricebookEntry WHERE Pricebook2Id = :pricebookId AND IsActive = true
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
    @description     : Save Proposal Lines (Multiple lines with product, quantity, OH, Warranty, Profit)
    @param           : {String} linesData - JSON string of proposal lines data
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

            // Parse the data: multiple proposal lines with product info
            Map<String, Object> data = (Map<String, Object>) JSON.deserializeUntyped(linesData);
            String proposalId = (String) data.get('proposalId');
            List<Object> proposalLinesData = (List<Object>) data.get('proposalLines');
            
            List<wfrecon__Proposal_Line__c> proposalLinesToInsert = new List<wfrecon__Proposal_Line__c>();
            
            for (Object lineObj : proposalLinesData) {
                Map<String, Object> lineData = (Map<String, Object>) lineObj;
                
                wfrecon__Proposal_Line__c proposalLine = new wfrecon__Proposal_Line__c();
                proposalLine.wfrecon__Proposal__c = proposalId;
                proposalLine.wfrecon__Product__c = (String) lineData.get('productId');
                proposalLine.wfrecon__Price_Book__c = (String) lineData.get('pricebookId');
                proposalLine.Name = (String) lineData.get('proposalLineName');
                proposalLine.wfrecon__Description__c = (String) lineData.get('description');
                proposalLine.wfrecon__Quantity__c = lineData.get('quantity') != null ? Decimal.valueOf(String.valueOf(lineData.get('quantity'))) : 0;
                proposalLine.wfrecon__OH_Per__c = lineData.get('oh') != null ? Decimal.valueOf(String.valueOf(lineData.get('oh'))) : 0;
                proposalLine.wfrecon__Warranty_Per__c = lineData.get('warranty') != null ? Decimal.valueOf(String.valueOf(lineData.get('warranty'))) : 0;
                proposalLine.wfrecon__Profit_Per__c = lineData.get('profit') != null ? Decimal.valueOf(String.valueOf(lineData.get('profit'))) : 0;
                
                proposalLinesToInsert.add(proposalLine);
            }
            
            if (!proposalLinesToInsert.isEmpty()) {
                insert as user proposalLinesToInsert;
                
                // Create budgets for each proposal line
                List<wfrecon__Budget__c> budgetsToInsert = new List<wfrecon__Budget__c>();
                for (wfrecon__Proposal_Line__c pLine : proposalLinesToInsert) {
                    wfrecon__Budget__c budget = new wfrecon__Budget__c();
                    budget.wfrecon__Proposal_Line__c = pLine.Id;
                    budgetsToInsert.add(budget);
                }
                
                if (!budgetsToInsert.isEmpty()) {
                    insert as user budgetsToInsert;
                }
            }
            
            result.put('success', true);
            result.put('message', 'Proposal lines saved successfully');
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
            result.put('message', 'Unable to save proposal lines. Please try again or contact your administrator.');
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
    @description     : Get Proposal Defaults (OH, Warranty, Profit)
    @param           : {String} proposalId - Proposal Record Id
    @return          : Map<String, Object> - Result with success status and defaults
    ********************************************************
    */
    @AuraEnabled
    public static Map<String, Object> getProposalDefaults(String proposalId) {
        Map<String, Object> result = new Map<String, Object>();
        try {
            if (String.isBlank(proposalId)) {
                result.put('success', false);
                result.put('message', 'Proposal ID is required');
                return result;
            }
            
            wfrecon__Proposal__c proposal = [SELECT Id, wfrecon__OH__c, wfrecon__Warranty__c, wfrecon__Profit__c 
                                              FROM wfrecon__Proposal__c 
                                              WHERE Id = :proposalId 
                                              WITH USER_MODE 
                                              LIMIT 1];
            
            Map<String, Object> defaults = new Map<String, Object>();
            defaults.put('oh', proposal.wfrecon__OH__c != null ? proposal.wfrecon__OH__c : 0);
            defaults.put('warranty', proposal.wfrecon__Warranty__c != null ? proposal.wfrecon__Warranty__c : 0);
            defaults.put('profit', proposal.wfrecon__Profit__c != null ? proposal.wfrecon__Profit__c : 0);
            
            result.put('success', true);
            result.put('message', 'Proposal defaults fetched successfully');
            result.put('data', defaults);
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{
                'className' => CLASSNAME,
                'methodName' => 'getProposalDefaults',
                'isApiException' => false,
                'statusCode' => null,
                'exceptionObj' => e,
                'moreDetails' => 'Error fetching proposal defaults for Id: ' + proposalId,
                'apiResponse' => null
            });
            result.put('success', false);
            result.put('message', 'Unable to fetch proposal defaults. Please try again or contact your administrator.');
            result.put('error', e.getMessage());
            result.put('data', new Map<String, Object>());
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

    /*
    *********************************************************
    @description     : Save All Changes (Proposal Lines + Budget Lines)
    @param           : {String} changesJson - JSON string containing both proposal lines and budget lines to update/insert
    @return          : Map<String, Object> - Result with success status and message
    ********************************************************
    */
    @AuraEnabled
    public static Map<String, Object> saveAllChanges(String changesJson) {
        Map<String, Object> result = new Map<String, Object>();
        Savepoint sp = Database.setSavepoint();
        
        try {
            if (String.isBlank(changesJson)) {
                result.put('success', false);
                result.put('message', 'Changes data is required');
                return result;
            }

            Map<String, Object> changesData = (Map<String, Object>) JSON.deserializeUntyped(changesJson);
            
            // Update Proposal Lines
            List<Object> proposalLinesData = (List<Object>) changesData.get('proposalLines');
            if (proposalLinesData != null && !proposalLinesData.isEmpty()) {
                List<wfrecon__Proposal_Line__c> proposalLinesToUpdate = new List<wfrecon__Proposal_Line__c>();
                
                for (Object lineObj : proposalLinesData) {
                    Map<String, Object> lineData = (Map<String, Object>) lineObj;
                    
                    wfrecon__Proposal_Line__c proposalLine = new wfrecon__Proposal_Line__c(
                        Id = (String) lineData.get('Id')
                    );

                    if (lineData.containsKey('wfrecon__Quantity__c')) {
                        proposalLine.wfrecon__Quantity__c = (Decimal) lineData.get('wfrecon__Quantity__c');
                    }
                    if (lineData.containsKey('wfrecon__Description__c')) {
                        proposalLine.wfrecon__Description__c = (String) lineData.get('wfrecon__Description__c');
                    }
                    // OH and Warranty percentages are read-only and not updated
                    if (lineData.containsKey('wfrecon__Profit_Per__c')) {
                        proposalLine.wfrecon__Profit_Per__c = (Decimal) lineData.get('wfrecon__Profit_Per__c');
                    }
                    if (lineData.containsKey('wfrecon__Sales_Price__c')) {
                        proposalLine.wfrecon__Sales_Price__c = (Decimal) lineData.get('wfrecon__Sales_Price__c');
                    }

                    proposalLinesToUpdate.add(proposalLine);
                }

                if (!proposalLinesToUpdate.isEmpty()) {
                    update as user proposalLinesToUpdate;
                }
            }

            // Handle Budget Lines (Insert + Update)
            List<Object> budgetLinesData = (List<Object>) changesData.get('budgetLines');
            if (budgetLinesData != null && !budgetLinesData.isEmpty()) {
                // Collect unique proposal line IDs to get their budgets
                Set<String> proposalLineIds = new Set<String>();
                Map<String, String> budgetIdByProposalLineId = new Map<String, String>();
                
                for (Object lineObj : budgetLinesData) {
                    Map<String, Object> lineData = (Map<String, Object>) lineObj;
                    String proposalLineId = (String) lineData.get('proposalLineId');
                    String budgetId = (String) lineData.get('budgetId');
                    
                    if (String.isNotBlank(proposalLineId)) {
                        proposalLineIds.add(proposalLineId);
                        if (String.isNotBlank(budgetId)) {
                            budgetIdByProposalLineId.put(proposalLineId, budgetId);
                        }
                    }
                }
                
                // Query existing budgets for proposal lines (budgets are always created with proposal lines)
                if (!proposalLineIds.isEmpty()) {
                    List<wfrecon__Budget__c> existingBudgets = [
                        SELECT Id, wfrecon__Proposal_Line__c 
                        FROM wfrecon__Budget__c 
                        WHERE wfrecon__Proposal_Line__c IN :proposalLineIds 
                        WITH USER_MODE
                    ];
                    
                    for (wfrecon__Budget__c budget : existingBudgets) {
                        budgetIdByProposalLineId.put(budget.wfrecon__Proposal_Line__c, budget.Id);
                    }
                }
                
                // Process budget lines
                List<wfrecon__Budget_Line__c> budgetLinesToInsert = new List<wfrecon__Budget_Line__c>();
                List<wfrecon__Budget_Line__c> budgetLinesToUpdate = new List<wfrecon__Budget_Line__c>();

                for (Object lineObj : budgetLinesData) {
                    Map<String, Object> lineData = (Map<String, Object>) lineObj;
                    String action = (String) lineData.get('action');
                    String costType = (String) lineData.get('costType');
                    String proposalLineId = (String) lineData.get('proposalLineId');
                    
                    wfrecon__Budget_Line__c budgetLine = new wfrecon__Budget_Line__c();
                    
                    if (action == 'update') {
                        budgetLine.Id = (String) lineData.get('Id');
                    }
                    
                    // Get the budget ID from our map
                    String budgetId = budgetIdByProposalLineId.get(proposalLineId);
                    if (String.isBlank(budgetId)) {
                        budgetId = (String) lineData.get('budgetId');
                    }
                    budgetLine.wfrecon__Cost_Type__c = costType == 'perdiem' ? 'Per Diem' : costType;
                    
                    // Set fields based on cost type (excluding formula fields)
                    if (costType == 'labor') {
                        budgetLine.wfrecon__No_Of_Crew_Members__c = (Decimal) lineData.get('noOfCrewMembers');
                        budgetLine.wfrecon__Hrs_day__c = (Decimal) lineData.get('hrsDay');
                        budgetLine.wfrecon__Burden_Rate_Hour__c = (Decimal) lineData.get('burdenRateHour');
                        budgetLine.wfrecon__of_Days__c = (Decimal) lineData.get('ofDays');
                        budgetLine.wfrecon__Note__c = (String) lineData.get('note');
                    } else if (costType == 'materials') {
                        budgetLine.wfrecon__Material__c = (String) lineData.get('materials');
                        budgetLine.wfrecon__QTY__c = (Decimal) lineData.get('qty');
                        budgetLine.wfrecon__Cost_Each__c = (Decimal) lineData.get('materialCostEach');
                    } else if (costType == 'hotel') {
                        budgetLine.wfrecon__Of_Nights__c = (Decimal) lineData.get('ofNights');
                        budgetLine.wfrecon__Number_Of_Rooms__c = (Decimal) lineData.get('numberOfRooms');
                        budgetLine.wfrecon__Costs_Per_Night__c = (Decimal) lineData.get('costsPerNight');
                    } else if (costType == 'mileage') {
                        budgetLine.wfrecon__Of_Trips__c = (Decimal) lineData.get('ofTrips');
                        budgetLine.wfrecon__Of_Trucks__c = (Decimal) lineData.get('ofTrucks');
                        budgetLine.wfrecon__Mileage__c = (Decimal) lineData.get('mileage');
                        budgetLine.wfrecon__Mileage_Rate__c = (Decimal) lineData.get('mileageRate');
                    } else if (costType == 'perdiem') {
                        budgetLine.wfrecon__Per_Diem_of_Days__c = (Decimal) lineData.get('perDiemOfDays');
                        budgetLine.wfrecon__Per_Diem_Rate__c = (Decimal) lineData.get('perDiemRate');
                        budgetLine.wfrecon__of_Men__c = (Decimal) lineData.get('ofMen');
                    }
                    
                    if (action == 'insert') {
                        budgetLine.wfrecon__Budget__c = budgetId;
                        budgetLinesToInsert.add(budgetLine);
                    } else {
                        budgetLinesToUpdate.add(budgetLine);
                    }
                }

                if (!budgetLinesToInsert.isEmpty()) {
                    insert as user budgetLinesToInsert;
                }
                if (!budgetLinesToUpdate.isEmpty()) {
                    update as user budgetLinesToUpdate;
                }
            }

            result.put('success', true);
            result.put('message', 'All changes saved successfully');
        } catch (Exception e) {
            Database.rollback(sp);
            ExceptionHandler.logException(new Map<String, Object>{
                'className' => CLASSNAME,
                'methodName' => 'saveAllChanges',
                'isApiException' => false,
                'statusCode' => null,
                'exceptionObj' => e,
                'moreDetails' => 'Error saving all changes',
                'apiResponse' => null
            });
            result.put('success', false);
            result.put('message', 'Unable to save changes. Please try again or contact your administrator.');
            result.put('error', e.getMessage());
        }
        return result;
    }
}