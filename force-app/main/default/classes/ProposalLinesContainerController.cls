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
            
            // Fetch Proposal Lines with Product and Budget information
            List<wfrecon__Proposal_Line__c> proposalLines = [
                SELECT Id, Name, wfrecon__Product__c, wfrecon__Product__r.Name, wfrecon__Total_Cost__c, 
                    wfrecon__Quantity__c, wfrecon__OH_Per__c, wfrecon__Warranty_Per__c, wfrecon__Profit_Per__c,
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
                proposalLine.Name = (String) lineData.get('proposalLineName');
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
    /*
    *********************************************************
    @description     : Save Budget Lines by Cost Type (Labor, Material, Hotel, Mileage, Per Diem)
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
                String costType = (String) budgetLineMap.get('costType');
                
                if (action == 'delete' && String.isNotBlank(budgetLineId)) {
                    budgetLineIdsToDelete.add(budgetLineId);
                } else if (action == 'insert') {
                    wfrecon__Budget_Line__c newBudgetLine = createBudgetLineFromMap(budgetLineMap, costType);
                    budgetLinesToInsert.add(newBudgetLine);
                } else if (String.isNotBlank(budgetLineId)) {
                    wfrecon__Budget_Line__c budgetLine = updateBudgetLineFromMap(budgetLineId, budgetLineMap, costType);
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
    @description     : Create Budget Line from Map based on Cost Type
    @param           : {Map<String, Object>} dataMap - Budget line data
    @param           : {String} costType - Cost type (labor, materials, hotel, mileage, perdiem)
    @return          : wfrecon__Budget_Line__c - New budget line record
    ********************************************************
    */
    private static wfrecon__Budget_Line__c createBudgetLineFromMap(Map<String, Object> dataMap, String costType) {
        system.debug('Creating budget line from map: ' + dataMap);

        wfrecon__Budget_Line__c budgetLine = new wfrecon__Budget_Line__c();
        budgetLine.wfrecon__Budget__c = (String) dataMap.get('budgetId');
        budgetLine.wfrecon__Cost_Type__c = costType;
        
        if (costType == 'labor') {
            budgetLine.wfrecon__No_Of_Crew_Members__c = getDecimalValue(dataMap, 'noOfCrewMembers');
            budgetLine.wfrecon__Hrs_day__c = getDecimalValue(dataMap, 'hrsDay');
            budgetLine.wfrecon__Burden_Rate_Hour__c = getDecimalValue(dataMap, 'burdenRateHour');
            budgetLine.wfrecon__of_Days__c = getDecimalValue(dataMap, 'ofDays');
            budgetLine.wfrecon__Note__c = (String) dataMap.get('note');
        } else if (costType == 'materials') {
            budgetLine.wfrecon__Material__c = (String) dataMap.get('materials');
            budgetLine.wfrecon__QTY__c = getDecimalValue(dataMap, 'qty');
            budgetLine.wfrecon__Cost_Each__c = getDecimalValue(dataMap, 'materialCostEach');
        } else if (costType == 'hotel') {
            budgetLine.wfrecon__Of_Nights__c = getDecimalValue(dataMap, 'ofNights');
            budgetLine.wfrecon__Number_Of_Rooms__c = getDecimalValue(dataMap, 'numberOfRooms');
            budgetLine.wfrecon__Costs_Per_Night__c = getDecimalValue(dataMap, 'costsPerNight');
        } else if (costType == 'mileage') {
            budgetLine.wfrecon__Of_Trips__c = getDecimalValue(dataMap, 'ofTrips');
            budgetLine.wfrecon__Of_Trucks__c = getDecimalValue(dataMap, 'ofTrucks');
            budgetLine.wfrecon__Mileage__c = getDecimalValue(dataMap, 'mileage');
            budgetLine.wfrecon__Mileage_Rate__c = getDecimalValue(dataMap, 'mileageRate');
        } else if (costType == 'perdiem') {
            budgetLine.wfrecon__Per_Diem_of_Days__c = getDecimalValue(dataMap, 'perDiemOfDays');
            budgetLine.wfrecon__Per_Diem_Rate__c = getDecimalValue(dataMap, 'perDiemRate');
            budgetLine.wfrecon__of_Men__c = getDecimalValue(dataMap, 'ofMen');
        }
        
        return budgetLine;
    }

    /*
    *********************************************************
    @description     : Update Budget Line from Map based on Cost Type
    @param           : {String} budgetLineId - Budget Line Id
    @param           : {Map<String, Object>} dataMap - Budget line data
    @param           : {String} costType - Cost type
    @return          : wfrecon__Budget_Line__c - Updated budget line record
    ********************************************************
    */
    private static wfrecon__Budget_Line__c updateBudgetLineFromMap(String budgetLineId, Map<String, Object> dataMap, String costType) {
        wfrecon__Budget_Line__c budgetLine = new wfrecon__Budget_Line__c();
        budgetLine.Id = budgetLineId;
        budgetLine.wfrecon__Cost_Type__c = costType;
        
        if (costType == 'labor') {
            budgetLine.wfrecon__No_Of_Crew_Members__c = getDecimalValue(dataMap, 'noOfCrewMembers');
            budgetLine.wfrecon__Hrs_day__c = getDecimalValue(dataMap, 'hrsDay');
            budgetLine.wfrecon__Burden_Rate_Hour__c = getDecimalValue(dataMap, 'burdenRateHour');
            budgetLine.wfrecon__of_Days__c = getDecimalValue(dataMap, 'ofDays');
            budgetLine.wfrecon__Note__c = (String) dataMap.get('note');
        } else if (costType == 'materials') {
            budgetLine.wfrecon__Material__c = (String) dataMap.get('materials');
            budgetLine.wfrecon__QTY__c = getDecimalValue(dataMap, 'qty');
            budgetLine.wfrecon__Cost_Each__c = getDecimalValue(dataMap, 'materialCostEach');
        } else if (costType == 'hotel') {
            budgetLine.wfrecon__Of_Nights__c = getDecimalValue(dataMap, 'ofNights');
            budgetLine.wfrecon__Number_Of_Rooms__c = getDecimalValue(dataMap, 'numberOfRooms');
            budgetLine.wfrecon__Costs_Per_Night__c = getDecimalValue(dataMap, 'costsPerNight');
        } else if (costType == 'mileage') {
            budgetLine.wfrecon__Of_Trips__c = getDecimalValue(dataMap, 'ofTrips');
            budgetLine.wfrecon__Of_Trucks__c = getDecimalValue(dataMap, 'ofTrucks');
            budgetLine.wfrecon__Mileage__c = getDecimalValue(dataMap, 'mileage');
            budgetLine.wfrecon__Mileage_Rate__c = getDecimalValue(dataMap, 'mileageRate');
        } else if (costType == 'perdiem') {
            budgetLine.wfrecon__Per_Diem_of_Days__c = getDecimalValue(dataMap, 'perDiemOfDays');
            budgetLine.wfrecon__Per_Diem_Rate__c = getDecimalValue(dataMap, 'perDiemRate');
            budgetLine.wfrecon__of_Men__c = getDecimalValue(dataMap, 'ofMen');
        }
        
        return budgetLine;
    }

    /*
    *********************************************************
    @description     : Helper method to safely get Decimal value from Map
    @param           : {Map<String, Object>} dataMap - Data map
    @param           : {String} key - Key to retrieve
    @return          : Decimal - Decimal value or null
    ********************************************************
    */
    private static Decimal getDecimalValue(Map<String, Object> dataMap, String key) {
        Object value = dataMap.get(key);
        if (value == null) return null;
        if (value instanceof Decimal) return (Decimal) value;
        if (value instanceof Integer) return Decimal.valueOf((Integer) value);
        if (value instanceof String) {
            String strValue = (String) value;
            return String.isNotBlank(strValue) ? Decimal.valueOf(strValue) : null;
        }
        return null;
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
}