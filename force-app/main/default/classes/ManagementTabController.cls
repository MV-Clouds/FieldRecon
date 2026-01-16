public with sharing class ManagementTabController {

    public static final String CLASSNAME = 'ManagementTabController';

    @AuraEnabled
    public static List<wfrecon__Process__c> getProcessLibraries() {
        List<wfrecon__Process__c> processLibraries = new List<wfrecon__Process__c>();
        
        try {
            processLibraries = [
                SELECT Id, Name, wfrecon__Process_Name__c, wfrecon__Weight__c, wfrecon__Unit_of_Measure__c, wfrecon__Process_Type__c
                FROM wfrecon__Process__c
                WITH USER_MODE
                ORDER BY CreatedDate DESC
            ];
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => CLASSNAME, 'methodName' => 'getProcessLibraries', 'isApiException' => false, 'statusCode' => null, 'exceptionObj' => e,'moreDetails' => 'Error fetching Process Libraries : ' + e.getMessage(), 'apiResponse' => null});
        }

        return processLibraries;
    }

    @AuraEnabled
    public static List<wfrecon__Crew__c> getCrewMembers() {
        List<wfrecon__Crew__c> crewMembers = new List<wfrecon__Crew__c>();
        
        try {
            crewMembers = [
                SELECT Id, Name, wfrecon__Description__c, wfrecon__Color_Code__c, wfrecon__Crew_Member_Count__c,
                       wfrecon__Crew_Leader__c,
                       wfrecon__Crew_Leader__r.wfrecon__Contact__c,
                       wfrecon__Crew_Leader__r.wfrecon__Contact__r.Name
                FROM wfrecon__Crew__c
                WITH USER_MODE
                ORDER BY CreatedDate DESC
            ];
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => CLASSNAME, 'methodName' => 'getCrewMembers', 'isApiException' => false, 'statusCode' => null, 'exceptionObj' => e,'moreDetails' => 'Error fetching Crew Members : ' + e.getMessage(), 'apiResponse' => null});
        }

        return crewMembers;
    }

    @AuraEnabled
    public static Integer getCrewMobilizationSummary(Id crewId) {
        if (crewId == null) {
            return 0;
        }

        try {
            Set<Id> mobilizationIds = new Set<Id>();
            for (wfrecon__Mobilization_Member__c member : [
                SELECT wfrecon__Mobilization__c
                FROM wfrecon__Mobilization_Member__c
                WHERE wfrecon__Crew__c = :crewId
                AND wfrecon__Mobilization__r.wfrecon__Start_Date__c >= TODAY
                AND wfrecon__Mobilization__c != null
                WITH USER_MODE
            ]) {
                mobilizationIds.add(member.wfrecon__Mobilization__c);
            }
            return mobilizationIds.size();
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => CLASSNAME, 'methodName' => 'getCrewMobilizationSummary','isApiException' => false,'statusCode' => null,'exceptionObj' => e,'moreDetails' => 'Error fetching crew mobilization summary : ' + e.getMessage(),'apiResponse' => null});
            return 0;
        }
    }

    @AuraEnabled
    public static Map<String, Object> saveCrew(Map<String, Object> crewData) {
        Map<String, Object> response = new Map<String, Object>{
            'status' => 'ERROR',
            'message' => 'Unable to save crew.'
        };
        Integer mobilizationsEvaluated = 0;
        Integer mobilizationAssignmentsCreated = 0;

        try {
            if (crewData == null || crewData.isEmpty()) {
                response.put('message', 'Crew details are required.');
                return response;
            }

            Object idValue = crewData.get('Id');
            Id crewId;
            if (idValue != null) {
                crewId = idValue instanceof Id ? (Id)idValue : Id.valueOf(String.valueOf(idValue));
            }

            Boolean isExistingCrew = crewId != null;

            String crewName = (String)crewData.get('Name');
            if (String.isBlank(crewName)) {
                response.put('message', 'Crew name is required.');
                return response;
            }

            wfrecon__Crew__c crewRecord = new wfrecon__Crew__c();
            crewRecord.Name = crewName;
            if (crewId != null) {
                crewRecord.Id = crewId;
            }

            if (crewData.containsKey('wfrecon__Description__c')) {
                crewRecord.wfrecon__Description__c = (String)crewData.get('wfrecon__Description__c');
            }

            if (crewData.containsKey('wfrecon__Color_Code__c')) {
                String colorCode = (String)crewData.get('wfrecon__Color_Code__c');
                if (!String.isBlank(colorCode) && !colorCode.startsWith('#')) {
                    colorCode = '#' + colorCode;
                }
                crewRecord.wfrecon__Color_Code__c = colorCode;
            }

            // Extract member IDs to add
            List<Id> membersToAdd = new List<Id>();
            if (crewData.get('membersToAdd') != null) {
                for (Object memberVal : (List<Object>)crewData.get('membersToAdd')) {
                    if (memberVal != null) {
                        membersToAdd.add(memberVal instanceof Id ? (Id)memberVal : Id.valueOf(String.valueOf(memberVal)));
                    }
                }
            }

            // Extract member record IDs to remove
            List<Id> memberRecordIdsToRemove = new List<Id>();
            if (crewData.get('membersToRemove') != null) {
                for (Object memberVal : (List<Object>)crewData.get('membersToRemove')) {
                    if (memberVal != null) {
                        memberRecordIdsToRemove.add(memberVal instanceof Id ? (Id)memberVal : Id.valueOf(String.valueOf(memberVal)));
                    }
                }
            }

            // Extract boolean flags
            Boolean assignToFutureMobilizations = crewData.get('assignToFutureMobilizations') == true;
            Boolean removeFromFutureMobilizations = crewData.get('removeFromFutureMobilizations') == true;

            // Extract mobilization assignments to skip
            Map<Id, Set<Id>> mobilizationAssignmentsToSkip = new Map<Id, Set<Id>>();
            if (crewData.get('mobilizationAssignmentsToSkip') instanceof Map<Object, Object>) {
                Map<Object, Object> skipMap = (Map<Object, Object>)crewData.get('mobilizationAssignmentsToSkip');
                for (Object contactKey : skipMap.keySet()) {
                    try {
                        Id contactId = Id.valueOf(String.valueOf(contactKey));
                        Set<Id> mobilizationIds = new Set<Id>();
                        
                        if (skipMap.get(contactKey) instanceof List<Object>) {
                            for (Object mobId : (List<Object>)skipMap.get(contactKey)) {
                                if (mobId != null) {
                                    mobilizationIds.add(Id.valueOf(String.valueOf(mobId)));
                                }
                            }
                        }
                        
                        if (!mobilizationIds.isEmpty()) {
                            mobilizationAssignmentsToSkip.put(contactId, mobilizationIds);
                        }
                    } catch (Exception ex) {
                        // Skip invalid entries
                        continue;
                    }
                }
            }

            // Extract leader contact ID
            Id leaderContactId;
            if (crewData.get('leaderContactId') != null) {
                String leaderString = String.valueOf(crewData.get('leaderContactId')).trim();
                if (String.isNotBlank(leaderString) && !'__none__'.equalsIgnoreCase(leaderString)) {
                    try {
                        leaderContactId = Id.valueOf(leaderString);
                    } catch (Exception ex) {
                        // Invalid ID format, leave as null
                    }
                }
            }

            if (crewRecord.Id == null) {
                insert crewRecord;
            } else {
                update crewRecord;
            }

            crewId = crewRecord.Id;

            if (!memberRecordIdsToRemove.isEmpty()) {
                List<wfrecon__Crew_Member__c> membersToDelete = [
                    SELECT Id, wfrecon__Contact__c
                    FROM wfrecon__Crew_Member__c
                    WHERE Id IN :memberRecordIdsToRemove
                    WITH USER_MODE
                ];

                Set<Id> removedContactIds = new Set<Id>();
                for (wfrecon__Crew_Member__c memberToDelete : membersToDelete) {
                    if (memberToDelete.wfrecon__Contact__c != null) {
                        removedContactIds.add(memberToDelete.wfrecon__Contact__c);
                    }
                }

                if (!membersToDelete.isEmpty()) {
                    delete membersToDelete;
                }

                if (removeFromFutureMobilizations && !removedContactIds.isEmpty()) {
                    Date today = Date.today();
                    List<wfrecon__Mobilization_Member__c> futureAssignments = [
                        SELECT Id
                        FROM wfrecon__Mobilization_Member__c
                        WHERE wfrecon__Contact__c IN :removedContactIds
                        AND wfrecon__Crew__c = :crewId
                        AND wfrecon__Mobilization__r.wfrecon__Start_Date__c >= :today
                        WITH USER_MODE
                    ];

                    if (!futureAssignments.isEmpty()) {
                        delete futureAssignments;
                    }
                }
            }

            if (!membersToAdd.isEmpty()) {
                Set<Id> contactIdsToInsert = new Set<Id>(membersToAdd);

                List<wfrecon__Crew_Member__c> existingMembers = [
                    SELECT Id, wfrecon__Contact__c
                    FROM wfrecon__Crew_Member__c
                    WHERE wfrecon__Crew__c = :crewId AND wfrecon__Contact__c IN :contactIdsToInsert
                    WITH USER_MODE
                ];

                for (wfrecon__Crew_Member__c existingMember : existingMembers) {
                    contactIdsToInsert.remove(existingMember.wfrecon__Contact__c);
                }

                if (!contactIdsToInsert.isEmpty()) {
                    List<wfrecon__Crew_Member__c> membersToInsert = new List<wfrecon__Crew_Member__c>();
                    for (Id contactId : contactIdsToInsert) {
                        membersToInsert.add(new wfrecon__Crew_Member__c(wfrecon__Crew__c = crewId, wfrecon__Contact__c = contactId));
                    }
                    insert membersToInsert;

                    if (assignToFutureMobilizations) {
                        MobilizationPropagationResult propagationResult = handleMobilizationPropagation(crewId, contactIdsToInsert, mobilizationAssignmentsToSkip);
                        mobilizationsEvaluated = propagationResult.mobilizationsEvaluated;
                        mobilizationAssignmentsCreated = propagationResult.assignmentsCreated;
                        response.put('mobilizationAssignmentsSkipped', propagationResult.assignmentsSkipped);
                    }
                }
            }

            if (crewId != null) {
                List<wfrecon__Crew_Member__c> crewMembersForLeaderSync = [
                    SELECT Id, wfrecon__Contact__c, wfrecon__Member_Type__c
                    FROM wfrecon__Crew_Member__c
                    WHERE wfrecon__Crew__c = :crewId
                    WITH USER_MODE
                ];

                List<wfrecon__Crew_Member__c> memberTypeUpdates = new List<wfrecon__Crew_Member__c>();
                Id assignedLeaderCrewMemberId;

                for (wfrecon__Crew_Member__c crewMemberRecord : crewMembersForLeaderSync) {
                    if (crewMemberRecord == null) {
                        continue;
                    }

                    Boolean isLeader = leaderContactId != null && crewMemberRecord.wfrecon__Contact__c == leaderContactId;
                    String desiredType = isLeader ? 'Leader' : 'Member';
                    String currentType = crewMemberRecord.wfrecon__Member_Type__c;

                    if (isLeader) {
                        assignedLeaderCrewMemberId = crewMemberRecord.Id;
                    }

                    if ((currentType == null && desiredType != null) || (currentType != null && desiredType != null && currentType != desiredType)) {
                        memberTypeUpdates.add(new wfrecon__Crew_Member__c(
                            Id = crewMemberRecord.Id,
                            wfrecon__Member_Type__c = desiredType
                        ));
                    }
                }

                if (!memberTypeUpdates.isEmpty()) {
                    update memberTypeUpdates;
                }

                Boolean shouldUpdateCrewLeader = assignedLeaderCrewMemberId != null || leaderContactId != null || isExistingCrew;
                if (shouldUpdateCrewLeader) {
                    wfrecon__Crew__c crewLeaderUpdate = new wfrecon__Crew__c(Id = crewId, wfrecon__Crew_Leader__c = assignedLeaderCrewMemberId);
                    update crewLeaderUpdate;

                    if (leaderContactId != null && assignedLeaderCrewMemberId == null) {
                        ExceptionHandler.logException(new Map<String, Object>{'className' => CLASSNAME,'methodName' => 'saveCrew','isApiException' => false,'statusCode' => null,'exceptionObj' => null,'moreDetails' => 'Crew leader contact provided but not associated with crew after save operation.','apiResponse' => null});
                    }
                }
            }

            response.put('status', 'SUCCESS');
            response.put('message', 'Crew saved successfully.');
            response.put('mobilizationAssignmentsCreated', mobilizationAssignmentsCreated);
            return response;
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => CLASSNAME, 'methodName' => 'saveCrew', 'isApiException' => false, 'statusCode' => null, 'exceptionObj' => e,'moreDetails' => 'Error saving Crew : ' + e.getMessage(), 'apiResponse' => null});
            response.put('message', 'Error: ' + e.getMessage());
            return response;
        }
    }

    @AuraEnabled
    public static List<MobilizationOverlapConflictDTO> getMobilizationOverlapConflicts(Id crewId, List<Id> contactIds) {
        List<MobilizationOverlapConflictDTO> conflicts = new List<MobilizationOverlapConflictDTO>();

        if (contactIds == null || contactIds.isEmpty()) {
            return conflicts;
        }

        try {
            Set<Id> uniqueContactIds = new Set<Id>(contactIds);
            Date today = Date.today();

            if (crewId == null) {
                conflicts.addAll(buildConflictsForCrewCreation(uniqueContactIds, today));
                return conflicts;
            }

            Map<Id, MobilizationTimeWindow> targetMobilizations = new Map<Id, MobilizationTimeWindow>();
            for (wfrecon__Mobilization_Member__c crewMobilization : [
                SELECT wfrecon__Mobilization__c, wfrecon__Mobilization__r.Name, wfrecon__Mobilization__r.wfrecon__Start_Date__c, wfrecon__Mobilization__r.wfrecon__End_Date__c
                FROM wfrecon__Mobilization_Member__c
                WHERE wfrecon__Crew__c = :crewId
                AND wfrecon__Mobilization__r.wfrecon__Start_Date__c >= :today
                AND wfrecon__Mobilization__c != null
                WITH USER_MODE
            ]) {
                Id mobilizationId = crewMobilization.wfrecon__Mobilization__c;
                if (mobilizationId == null || targetMobilizations.containsKey(mobilizationId)) {
                    continue;
                }

                MobilizationTimeWindow window = new MobilizationTimeWindow();
                window.mobilizationId = mobilizationId;
                if (crewMobilization.wfrecon__Mobilization__r != null) {
                    window.name = crewMobilization.wfrecon__Mobilization__r.Name;
                    window.startDateTime = crewMobilization.wfrecon__Mobilization__r.wfrecon__Start_Date__c;
                    window.endDateTime = crewMobilization.wfrecon__Mobilization__r.wfrecon__End_Date__c;
                }

                if (window.startDateTime == null) {
                    continue;
                }

                targetMobilizations.put(mobilizationId, window);
            }

            if (targetMobilizations.isEmpty()) {
                return conflicts;
            }

            Map<Id, List<MobilizationAssignmentInfo>> assignmentsByContact = new Map<Id, List<MobilizationAssignmentInfo>>();
            for (wfrecon__Mobilization_Member__c assignment : [
                SELECT Id, wfrecon__Contact__c, wfrecon__Contact__r.Name, wfrecon__Mobilization__c, wfrecon__Mobilization__r.Name,
                       wfrecon__Mobilization__r.wfrecon__Start_Date__c, wfrecon__Mobilization__r.wfrecon__End_Date__c,
                       wfrecon__Crew__c, wfrecon__Crew__r.Name
                FROM wfrecon__Mobilization_Member__c
                WHERE wfrecon__Contact__c IN :uniqueContactIds
                AND wfrecon__Mobilization__r.wfrecon__Start_Date__c >= :today
                AND wfrecon__Mobilization__c != null
                WITH USER_MODE
            ]) {
                if (assignment.wfrecon__Contact__c == null) {
                    continue;
                }

                List<MobilizationAssignmentInfo> contactAssignments = assignmentsByContact.get(assignment.wfrecon__Contact__c);
                if (contactAssignments == null) {
                    contactAssignments = new List<MobilizationAssignmentInfo>();
                    assignmentsByContact.put(assignment.wfrecon__Contact__c, contactAssignments);
                }

                MobilizationAssignmentInfo info = new MobilizationAssignmentInfo();
                info.contactId = assignment.wfrecon__Contact__c;
                info.contactName = assignment.wfrecon__Contact__r != null ? assignment.wfrecon__Contact__r.Name : null;
                info.mobilizationId = assignment.wfrecon__Mobilization__c;
                if (assignment.wfrecon__Mobilization__r != null) {
                    info.mobilizationName = assignment.wfrecon__Mobilization__r.Name;
                    info.startDateTime = assignment.wfrecon__Mobilization__r.wfrecon__Start_Date__c;
                    info.endDateTime = assignment.wfrecon__Mobilization__r.wfrecon__End_Date__c;
                }
                info.crewId = assignment.wfrecon__Crew__c;
                info.crewName = assignment.wfrecon__Crew__r != null ? assignment.wfrecon__Crew__r.Name : null;

                contactAssignments.add(info);
            }

            for (Id contactId : uniqueContactIds) {
                if (!assignmentsByContact.containsKey(contactId)) {
                    continue;
                }

                List<MobilizationAssignmentInfo> existingAssignments = assignmentsByContact.get(contactId);
                for (MobilizationTimeWindow targetWindow : targetMobilizations.values()) {
                    if (targetWindow == null || targetWindow.startDateTime == null) {
                        continue;
                    }

                    for (MobilizationAssignmentInfo assignmentInfo : existingAssignments) {
                        if (assignmentInfo == null || assignmentInfo.mobilizationId == null) {
                            continue;
                        }

                        if (assignmentInfo.mobilizationId == targetWindow.mobilizationId) {
                            continue;
                        }

                        if (!windowsOverlap(targetWindow.startDateTime, targetWindow.endDateTime, assignmentInfo.startDateTime, assignmentInfo.endDateTime)) {
                            continue;
                        }

                        MobilizationOverlapConflictDTO conflict = new MobilizationOverlapConflictDTO();
                        conflict.contactId = contactId;
                        conflict.contactName = assignmentInfo.contactName;
                        conflict.targetMobilizationId = targetWindow.mobilizationId;
                        conflict.targetMobilizationName = targetWindow.name;
                        conflict.targetStart = targetWindow.startDateTime;
                        conflict.targetEnd = targetWindow.endDateTime;
                        conflict.conflictingMobilizationId = assignmentInfo.mobilizationId;
                        conflict.conflictingMobilizationName = assignmentInfo.mobilizationName;
                        conflict.conflictingStart = assignmentInfo.startDateTime;
                        conflict.conflictingEnd = assignmentInfo.endDateTime;
                        conflict.conflictingCrewName = assignmentInfo.crewName;

                        conflicts.add(conflict);
                    }
                }
            }
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => CLASSNAME,'methodName' => 'getMobilizationOverlapConflicts','isApiException' => false,'statusCode' => null,'exceptionObj' => e,'moreDetails' => 'Error computing mobilization overlap conflicts : ' + e.getMessage(),'apiResponse' => null});
        }

        return conflicts;
    }

    @AuraEnabled
    public static String deleteProcess(String processId) {
        try {
            
            if (processId != null) {
                delete as user (new wfrecon__Process__c(Id = processId));
                return 'Success';
            } else {
                return 'Process not found';
            }
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => CLASSNAME, 'methodName' => 'deleteProcess', 'isApiException' => false, 'statusCode' => null, 'exceptionObj' => e,'moreDetails' => 'Error deleting Process : ' + e.getMessage(), 'apiResponse' => null});
            return 'Error: ' + e.getMessage();
        }
    }

    @AuraEnabled
    public static wfrecon__Process__c upsertProcess(wfrecon__Process__c processRecord) {
        try {
            if (processRecord != null) {
                upsert as user processRecord;
                return processRecord;
            } else {
                throw new AuraHandledException('Process record is null');
            }
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => CLASSNAME, 'methodName' => 'upsertProcess', 'isApiException' => false, 'statusCode' => null, 'exceptionObj' => e,'moreDetails' => 'Error upserting Process : ' + e.getMessage(), 'apiResponse' => null});
            return null;
        }
    }

    @AuraEnabled
    public static Map<String, Object> getCrewContacts(Id crewId) {
        List<CrewContactDTO> assignedContacts = new List<CrewContactDTO>();
        List<CrewContactDTO> availableContacts = new List<CrewContactDTO>();

        Map<String, Object> response = new Map<String, Object>{
            'assignedContacts' => assignedContacts,
            'availableContacts' => availableContacts
        };

        try {
            // Get current crew leader member ID for comparison
            Id crewLeaderMemberId;
            if (crewId != null) {
                List<wfrecon__Crew__c> crews = [
                    SELECT wfrecon__Crew_Leader__c
                    FROM wfrecon__Crew__c
                    WHERE Id = :crewId
                    WITH USER_MODE
                    LIMIT 1
                ];
                if (!crews.isEmpty()) {
                    crewLeaderMemberId = crews[0].wfrecon__Crew_Leader__c;
                }
            }

            Id crewLeaderContactId;
            List<Contact> crewCandidates = [
                SELECT Id, Name,
                    (SELECT Id, wfrecon__Crew__c, wfrecon__Crew__r.Name, wfrecon__Crew__r.wfrecon__Color_Code__c, wfrecon__Member_Type__c
                     FROM wfrecon__Crew_Members__r)
                FROM Contact
                WHERE RecordType.DeveloperName = 'Employee_WF_Recon'
                AND wfrecon__User__r.IsActive = true
                WITH USER_MODE
                ORDER BY Name
            ];

            for (Contact contactRecord : crewCandidates) {
                CrewContactDTO contactDto = new CrewContactDTO();
                contactDto.id = contactRecord.Id;
                contactDto.name = contactRecord.Name;
                contactDto.isAssignedElsewhere = false;
                contactDto.isAssignedToCurrentCrew = false;
                contactDto.isCurrentCrewLeader = false;
                contactDto.currentCrewMemberType = null;

                if (contactRecord.wfrecon__Crew_Members__r != null && !contactRecord.wfrecon__Crew_Members__r.isEmpty()) {
                    List<String> crewNames = new List<String>();

                    for (wfrecon__Crew_Member__c member : contactRecord.wfrecon__Crew_Members__r) {
                        CrewMemberDTO memberDto = new CrewMemberDTO();
                        memberDto.memberId = member.Id;
                        memberDto.crewId = member.wfrecon__Crew__c;
                        memberDto.crewName = member.wfrecon__Crew__r != null ? member.wfrecon__Crew__r.Name : null;
                        memberDto.colorCode = member.wfrecon__Crew__r != null ? member.wfrecon__Crew__r.wfrecon__Color_Code__c : null;
                        memberDto.memberType = member.wfrecon__Member_Type__c;
                        contactDto.members.add(memberDto);

                        if (!String.isBlank(memberDto.crewName)) {
                            crewNames.add(memberDto.crewName);
                        }

                        if (crewId != null && member.wfrecon__Crew__c == crewId) {
                            contactDto.isAssignedToCurrentCrew = true;
                            contactDto.currentCrewMemberId = member.Id;
                            contactDto.currentCrewMemberType = member.wfrecon__Member_Type__c;
                        } else if (member.wfrecon__Crew__c != null) {
                            contactDto.isAssignedElsewhere = true;
                        }

                        if ((crewLeaderMemberId != null && member.Id == crewLeaderMemberId)
                            || ('Leader'.equalsIgnoreCase(member.wfrecon__Member_Type__c) && crewId != null && member.wfrecon__Crew__c == crewId)) {
                            contactDto.isCurrentCrewLeader = true;
                            crewLeaderContactId = contactRecord.Id;
                        }

                        if (String.isBlank(contactDto.primaryCrewColor) && !String.isBlank(memberDto.colorCode)) {
                            contactDto.primaryCrewColor = memberDto.colorCode;
                        }
                    }

                    contactDto.assignedCrewNames = crewNames.isEmpty() ? null : String.join(crewNames, ', ');
                }

                if (contactDto.isAssignedToCurrentCrew) {
                    assignedContacts.add(contactDto);
                } else {
                    availableContacts.add(contactDto);
                }
            }

            availableContacts.sort();
            assignedContacts.sort();

            response.put('crewLeaderContactId', crewLeaderContactId);
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => CLASSNAME, 'methodName' => 'getCrewContacts', 'isApiException' => false, 'statusCode' => null, 'exceptionObj' => e,'moreDetails' => 'Error fetching crew contacts : ' + e.getMessage(), 'apiResponse' => null});
        }

        return response;
    }

    @AuraEnabled
    public static String deleteCrew(String crewId) {
        try {
            if (crewId != null) {
                delete as user (new wfrecon__Crew__c(Id = crewId));  
                return 'Success';
            } else {
                return 'Crew not found';
            }
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => CLASSNAME, 'methodName' => 'deleteCrew', 'isApiException' => false, 'statusCode' => null, 'exceptionObj' => e,'moreDetails' => 'Error deleting Crew : ' + e.getMessage(), 'apiResponse' => null});
            return 'Error: ' + e.getMessage();
        }
    }

    @AuraEnabled
    public static List<wfrecon__Cost_Code__c> getCostCodes() {
        List<wfrecon__Cost_Code__c> costCodes = new List<wfrecon__Cost_Code__c>();
        
        try {
            costCodes = [
                SELECT Id, Name, wfrecon__Classification_Type__c, wfrecon__Code__c, wfrecon__Level_Code__c
                FROM wfrecon__Cost_Code__c
                WITH USER_MODE
                ORDER BY CreatedDate DESC
            ];
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => CLASSNAME, 'methodName' => 'getCostCodes', 'isApiException' => false, 'statusCode' => null, 'exceptionObj' => e,'moreDetails' => 'Error fetching Cost Codes : ' + e.getMessage(), 'apiResponse' => null});
        }

        return costCodes;
    }

    @AuraEnabled
    public static String deleteCostCode(String costCodeId) {
        try {
            if (costCodeId != null) {
                delete as user (new wfrecon__Cost_Code__c(Id = costCodeId));
                return 'Success';
            } else {
                return 'Cost Code not found';
            }
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => CLASSNAME, 'methodName' => 'deleteCostCode', 'isApiException' => false, 'statusCode' => null, 'exceptionObj' => e,'moreDetails' => 'Error deleting Cost Code : ' + e.getMessage(), 'apiResponse' => null});
            return 'Error: ' + e.getMessage();
        }
    }

    @AuraEnabled
    public static wfrecon__Cost_Code__c upsertCostCode(wfrecon__Cost_Code__c costCodeRecord) {
        try {
            if (costCodeRecord != null) {
                upsert as user costCodeRecord;
                return costCodeRecord;
            } else {
                throw new AuraHandledException('Cost Code record is null');
            }
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => CLASSNAME, 'methodName' => 'upsertCostCode', 'isApiException' => false, 'statusCode' => null, 'exceptionObj' => e,'moreDetails' => 'Error upserting Cost Code : ' + e.getMessage(), 'apiResponse' => null});
            return null;
        }
    }

    private class MobilizationPropagationResult {
        public Integer mobilizationsEvaluated = 0;
        public Integer assignmentsCreated = 0;
        public Integer assignmentsSkipped = 0;
    }

    private static MobilizationPropagationResult handleMobilizationPropagation(Id crewId, Set<Id> contactIdsToInsert, Map<Id, Set<Id>> assignmentsToSkip) {
        MobilizationPropagationResult result = new MobilizationPropagationResult();

        if (crewId == null || contactIdsToInsert == null || contactIdsToInsert.isEmpty()) {
            return result;
        }

        Date today = Date.today();
        List<wfrecon__Mobilization_Member__c> crewMobilizations = [
            SELECT wfrecon__Mobilization__c
            FROM wfrecon__Mobilization_Member__c
            WHERE wfrecon__Crew__c = :crewId
            AND wfrecon__Mobilization__r.wfrecon__Start_Date__c >= :today
            AND wfrecon__Mobilization__c != null
            WITH USER_MODE
        ];

        Set<Id> mobilizationIds = new Set<Id>();
        for (wfrecon__Mobilization_Member__c crewMob : crewMobilizations) {
            if (crewMob.wfrecon__Mobilization__c != null) {
                mobilizationIds.add(crewMob.wfrecon__Mobilization__c);
            }
        }

        result.mobilizationsEvaluated = mobilizationIds.size();

        if (mobilizationIds.isEmpty()) {
            return result;
        }

        Map<Id, Set<Id>> existingAssignments = new Map<Id, Set<Id>>();
        for (wfrecon__Mobilization_Member__c existingAssignment : [
            SELECT wfrecon__Mobilization__c, wfrecon__Contact__c
            FROM wfrecon__Mobilization_Member__c
            WHERE wfrecon__Mobilization__c IN :mobilizationIds
            AND wfrecon__Contact__c IN :contactIdsToInsert
            WITH USER_MODE
        ]) {
            if (existingAssignment.wfrecon__Mobilization__c == null || existingAssignment.wfrecon__Contact__c == null) {
                continue;
            }

            if (!existingAssignments.containsKey(existingAssignment.wfrecon__Mobilization__c)) {
                existingAssignments.put(existingAssignment.wfrecon__Mobilization__c, new Set<Id>());
            }
            existingAssignments.get(existingAssignment.wfrecon__Mobilization__c).add(existingAssignment.wfrecon__Contact__c);
        }

        Map<Id, Set<Id>> safeAssignmentsToSkip = assignmentsToSkip == null
            ? new Map<Id, Set<Id>>()
            : assignmentsToSkip;

        List<wfrecon__Mobilization_Member__c> mobilizationInserts = new List<wfrecon__Mobilization_Member__c>();
        for (Id mobilizationId : mobilizationIds) {
            Set<Id> alreadyAssigned = existingAssignments.containsKey(mobilizationId)
                ? existingAssignments.get(mobilizationId)
                : new Set<Id>();

            for (Id contactId : contactIdsToInsert) {
                if (contactId == null || (alreadyAssigned != null && alreadyAssigned.contains(contactId))) {
                    continue;
                }

                Set<Id> skipForContact = safeAssignmentsToSkip.containsKey(contactId)
                    ? safeAssignmentsToSkip.get(contactId)
                    : null;

                if (skipForContact != null && skipForContact.contains(mobilizationId)) {
                    result.assignmentsSkipped++;
                    continue;
                }

                mobilizationInserts.add(new wfrecon__Mobilization_Member__c(
                    wfrecon__Mobilization__c = mobilizationId,
                    wfrecon__Contact__c = contactId,
                    wfrecon__Crew__c = crewId
                ));
            }
        }

        if (mobilizationInserts.isEmpty()) {
            return result;
        }

        insert as user mobilizationInserts;
        result.assignmentsCreated = mobilizationInserts.size();

        return result;
    }

    private static List<MobilizationOverlapConflictDTO> buildConflictsForCrewCreation(Set<Id> contactIds, Date startDateThreshold) {
        List<MobilizationOverlapConflictDTO> conflicts = new List<MobilizationOverlapConflictDTO>();

        if (contactIds == null || contactIds.isEmpty()) {
            return conflicts;
        }

        Date threshold = startDateThreshold == null ? Date.today() : startDateThreshold;

        for (wfrecon__Mobilization_Member__c assignment : [
            SELECT wfrecon__Contact__c, wfrecon__Contact__r.Name,
                   wfrecon__Mobilization__c, wfrecon__Mobilization__r.Name, wfrecon__Mobilization__r.wfrecon__Start_Date__c, wfrecon__Mobilization__r.wfrecon__End_Date__c,
                   wfrecon__Crew__c, wfrecon__Crew__r.Name
            FROM wfrecon__Mobilization_Member__c
            WHERE wfrecon__Contact__c IN :contactIds
            AND wfrecon__Mobilization__r.wfrecon__Start_Date__c >= :threshold
            AND wfrecon__Mobilization__r.wfrecon__Start_Date__c != null
            AND wfrecon__Mobilization__c != null
            WITH USER_MODE
            ORDER BY wfrecon__Mobilization__r.wfrecon__Start_Date__c ASC
        ]) {
            MobilizationOverlapConflictDTO conflict = new MobilizationOverlapConflictDTO();
            conflict.contactId = assignment.wfrecon__Contact__c;
            conflict.contactName = assignment.wfrecon__Contact__r != null ? assignment.wfrecon__Contact__r.Name : null;
            conflict.targetMobilizationId = null;
            conflict.targetMobilizationName = 'New crew mobilizations';
            conflict.targetStart = assignment.wfrecon__Mobilization__r != null ? assignment.wfrecon__Mobilization__r.wfrecon__Start_Date__c : null;
            conflict.targetEnd = assignment.wfrecon__Mobilization__r != null ? assignment.wfrecon__Mobilization__r.wfrecon__End_Date__c : null;
            conflict.conflictingMobilizationId = assignment.wfrecon__Mobilization__c;
            conflict.conflictingMobilizationName = assignment.wfrecon__Mobilization__r != null ? assignment.wfrecon__Mobilization__r.Name : null;
            conflict.conflictingStart = conflict.targetStart;
            conflict.conflictingEnd = conflict.targetEnd;
            conflict.conflictingCrewName = assignment.wfrecon__Crew__r != null ? assignment.wfrecon__Crew__r.Name : null;

            conflicts.add(conflict);
        }

        return conflicts;
    }

    private static Boolean windowsOverlap(Datetime startA, Datetime endA, Datetime startB, Datetime endB) {
        if (startA == null || startB == null) {
            return false;
        }

        Datetime normalizedEndA = normalizeEndDateTime(startA, endA);
        Datetime normalizedEndB = normalizeEndDateTime(startB, endB);

        if (normalizedEndA == null || normalizedEndB == null) {
            return false;
        }

        return startA < normalizedEndB && startB < normalizedEndA;
    }

    private static Datetime normalizeEndDateTime(Datetime startValue, Datetime endValue) {
        if (startValue == null) {
            return null;
        }

        if (endValue == null) {
            return startValue;
        }

        if (endValue <= startValue) {
            return endValue.addDays(1);
        }

        return endValue;
    }


    @AuraEnabled
    public static List<String> getMobilizationPicklistValues() {
        Schema.DescribeFieldResult fieldResult = wfrecon__Mobilization__c.wfrecon__Mobilization_Status__c.getDescribe();
        List<String> picklistValues = new List<String>();
        for (Schema.PicklistEntry entry : fieldResult.getPicklistValues()) {
            if (entry.isActive()) {
                picklistValues.add(entry.getValue());
            }
        }
        return picklistValues;
    }

    @AuraEnabled
    public static String updateGlobalPicklistValues(List<String> valuesToAdd, List<String> valuesToDeactivate) {
        if ((valuesToAdd == null || valuesToAdd.isEmpty()) && (valuesToDeactivate == null || valuesToDeactivate.isEmpty())) {
            return 'Error: No values provided to add or deactivate.';
        }

        try {
            // Create Metadata API service instance
            MetadataService.MetadataPort service = MetadataUtil.createService();

            // Read the Global Value Set
            MetadataService.GlobalValueSet globalValueSet =
                (MetadataService.GlobalValueSet) service
                    .readMetadata('GlobalValueSet', new List<String>{ 'wfrecon__Mobilization_Status' })
                    .getRecords()[0];

            if (globalValueSet == null){
                return 'Error: Global Value Set not found.';
            }

            // Get the list of custom values
            List<MetadataService.CustomValue> existingValues = globalValueSet.customValue;

            if (existingValues == null) {
                existingValues = new List<MetadataService.CustomValue>();
            }

            // 🟢 Add new values OR reactivate existing ones
            for (String newValue : valuesToAdd) {
                
                // ✅ CHANGED: We use this flag to check if we found it at all.
                Boolean valueFound = false; 

                for (MetadataService.CustomValue cv : existingValues) {
                    if (cv.fullName == newValue) {
                        valueFound = true; // Mark as found

                        // ✅ CHANGED: If it's inactive, reactivate it.
                        if (!cv.isActive) {
                            cv.isActive = true; 
                        }
                        break; // Found it, no need to keep looping
                    }
                }

                // ✅ CHANGED: Only add a new value if it was *never* found.
                if (!valueFound && String.isNotBlank(newValue)) {
                    MetadataService.CustomValue newPickVal = new MetadataService.CustomValue();
                    newPickVal.fullName = newValue;
                    newPickVal.label = newValue;
                    newPickVal.default_x = false;
                    newPickVal.isActive = true;
                    existingValues.add(newPickVal);
                }
            }

            // 🔴 Deactivate values (This logic was already correct)
            for (String valToDeactivate : valuesToDeactivate) {
                for (MetadataService.CustomValue cv : existingValues) {
                    if (cv.fullName == valToDeactivate) {
                        cv.isActive = false;
                        break;
                    }
                }
            }

            // Assign the modified list back
            globalValueSet.customValue = existingValues;

            // 🧩 Update Metadata
            service.updateMetadata(
                new MetadataService.Metadata[]{ globalValueSet }
            );

            return 'SUCCESS';
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => CLASSNAME, 'methodName' => 'updateGlobalPicklistValues', 'isApiException' => true, 'statusCode' => null, 'exceptionObj' => e,'moreDetails' => 'Error updating global picklist values: ' + e.getMessage(), 'apiResponse' => null});
            return 'Error while upading picklist values. Please contact system administrator.';
        }
    }

    @AuraEnabled
    public static List<Contact> getContacts() {
        List<Contact> contacts = new List<Contact>();
        
        try {
            contacts = [
                SELECT Id, FirstName, LastName, Name, Email, RecordType,
                       RecordType.DeveloperName, wfrecon__Can_Clock_In_Out__c
                FROM Contact
                WHERE RecordType.DeveloperName IN ('Employee_WF_Recon', 'Sub_Contractor_WF_Recon')
                WITH USER_MODE
                ORDER BY Name ASC
            ];
        } catch (Exception e) {
            System.debug('Error in getContacts: ' + e.getMessage());
            ExceptionHandler.logException(new Map<String, Object>{'className' => CLASSNAME, 'methodName' => 'getContacts', 'isApiException' => false, 'statusCode' => null, 'exceptionObj' => e,'moreDetails' => 'Error upserting Cost Code : ' + e.getMessage(), 'apiResponse' => null});            
        }

        return contacts;
    }

    @AuraEnabled
    public static Boolean checkUserHasSalesforceLicense() {
        try {
            User currentUser = [
                SELECT Profile.UserLicense.Name 
                FROM User 
                WHERE Id = :UserInfo.getUserId() 
                WITH USER_MODE 
                LIMIT 1
            ];
            
            String licenseName = currentUser.Profile.UserLicense.Name;
            
            return licenseName == 'Salesforce';
        } catch (Exception e) {
            System.debug(LoggingLevel.ERROR, CLASSNAME + '.checkUserHasSalesforceLicense - Exception: ' + e.getMessage());
            ExceptionHandler.logException(new Map<String, Object>{'className' => CLASSNAME , 'methodName' => 'checkUserHasSalesforceLicense', 'exceptionObj' => e, 'moreDetails' =>  e.getMessage()});
            // Default to false for security - if we can't determine license, restrict access
            return false;
        }
    }

    // @AuraEnabled
    // public static Contact upsertContact(Map<String, Object> contactData) {
    //     try {
    //         if (contactData == null || contactData.isEmpty()) {
    //             throw new AuraHandledException('Contact data is required.');
    //         }

    //         // Extract RecordTypeDeveloperName before creating Contact record
    //         String recordTypeDeveloperName = (String) contactData.get('RecordTypeDeveloperName');
            
    //         // Remove the custom field from the map so it doesn't cause issues
    //         contactData.remove('RecordTypeDeveloperName');
            
    //         // Remove Id temporarily to handle it separately
    //         Id contactId = null;
    //         if (contactData.containsKey('Id') && contactData.get('Id') != null) {
    //             Object idValue = contactData.get('Id');
    //             contactId = idValue instanceof Id ? (Id)idValue : Id.valueOf(String.valueOf(idValue));
    //             contactData.remove('Id');
    //         }
            
    //         // Create Contact record from the remaining data
    //         Contact contactRecord = new Contact();
            
    //         // Set Id if it exists (for updates)
    //         if (contactId != null) {
    //             contactRecord.Id = contactId;
    //         }
            
    //         // Dynamically set all fields from the map
    //         for (String fieldName : contactData.keySet()) {
    //             Object fieldValue = contactData.get(fieldName);
                
    //             // Skip null values
    //             if (fieldValue == null) {
    //                 continue;
    //             }
                
    //             // Skip internal fields
    //             if (fieldName.equalsIgnoreCase('RecordType.DeveloperName') || 
    //                 fieldName.equalsIgnoreCase('RecordTypeId') ||
    //                 fieldName.equalsIgnoreCase('Name')) {
    //                 continue;
    //             }
                
    //             try {
    //                 // Check if this is a Date field
    //                 Schema.DescribeFieldResult fieldDescribe = Contact.getSObjectType()
    //                     .getDescribe()
    //                     .fields.getMap()
    //                     .get(fieldName)
    //                     ?.getDescribe();
                    
    //                 if (fieldDescribe != null) {
    //                     Schema.DisplayType fieldType = fieldDescribe.getType();
                        
    //                     // Handle Date fields specifically
    //                     if (fieldType == Schema.DisplayType.Date && fieldValue instanceof String) {
    //                         String dateStr = (String)fieldValue;
    //                         // Parse the date string (expecting format like '2024-01-01')
    //                         Date parsedDate = Date.valueOf(dateStr);
    //                         contactRecord.put(fieldName, parsedDate);
    //                     }
    //                     // Handle DateTime fields
    //                     else if (fieldType == Schema.DisplayType.DateTime && fieldValue instanceof String) {
    //                         String datetimeStr = (String)fieldValue;
    //                         // Parse ISO 8601 format (e.g., '2024-01-01T10:00:00Z')
    //                         DateTime parsedDateTime = DateTime.valueOfGmt(datetimeStr.replace('T', ' ').replace('Z', ''));
    //                         contactRecord.put(fieldName, parsedDateTime);
    //                     }
    //                     // Handle other field types
    //                     else {
    //                         contactRecord.put(fieldName, fieldValue);
    //                     }
    //                 } else {
    //                     // For custom fields or if describe info not available, try direct assignment
    //                     contactRecord.put(fieldName, fieldValue);
    //                 }
    //             } catch (Exception fieldEx) {
    //                 System.debug('Warning: Could not set field ' + fieldName + ': ' + fieldEx.getMessage());
    //                 // Continue with other fields if one fails
    //             }
    //         }
            
    //         // Handle RecordType assignment for new records
    //         if (contactRecord.Id == null && String.isNotBlank(recordTypeDeveloperName)) {
    //             List<RecordType> recordTypes = [
    //                 SELECT Id 
    //                 FROM RecordType 
    //                 WHERE DeveloperName = :recordTypeDeveloperName 
    //                 AND SObjectType = 'Contact' 
    //                 LIMIT 1
    //             ];
                
    //             if (!recordTypes.isEmpty()) {
    //                 contactRecord.RecordTypeId = recordTypes[0].Id;
    //             } else {
    //                 throw new AuraHandledException('Invalid Record Type: ' + recordTypeDeveloperName);
    //             }
    //         }
            
    //         upsert as user contactRecord;
            
    //         // Return the full contact record with RecordType info
    //         return [
    //             SELECT Id, FirstName, LastName, Name, Email, 
    //                 RecordType.DeveloperName, wfrecon__Can_Clock_In_Out__c
    //             FROM Contact
    //             WHERE Id = :contactRecord.Id
    //             WITH USER_MODE
    //         ];
    //     } catch (Exception e) {
    //         System.debug('Error in upsertContact: ' + e.getMessage() + ' Stack trace: ' + e.getStackTraceString());
    //         ExceptionHandler.logException(new Map<String, Object>{
    //             'className' => 'YourClassNameHere', 
    //             'methodName' => 'upsertContact', 
    //             'exceptionObj' => e, 
    //             'moreDetails' => e.getMessage()
    //         });
    //         throw new AuraHandledException('Error processing contact: ' + e.getMessage());
    //     }
    // }

    @AuraEnabled
    public static String deleteContact(String contactId) {
        try {
            Contact contactToDelete = [SELECT Id FROM Contact WHERE Id = :contactId WITH USER_MODE LIMIT 1];
            delete as user contactToDelete;
            return 'Success';
        } catch (Exception e) {
            System.debug('Error in deleteContact: ' + e.getMessage());
            return 'Error: ' + e.getMessage();
        }
    }
    
    @AuraEnabled
    public static List<StatusColorWrapper> getMobilizationStatusColors() {
        List<StatusColorWrapper> statusColorList = new List<StatusColorWrapper>();
        
        try {
            // Get all custom setting records
            Map<String, wfrecon__Mobilization_Status_Color__c> customSettingsMap = wfrecon__Mobilization_Status_Color__c.getAll();
            
            // Get picklist values from wfrecon__Mobilization__c.wfrecon__Mobilization_Status__c field
            Schema.DescribeFieldResult fieldResult = wfrecon__Mobilization__c.wfrecon__Mobilization_Status__c.getDescribe();
            List<Schema.PicklistEntry> picklistValues = fieldResult.getPicklistValues();
            
            for (Schema.PicklistEntry entry : picklistValues) {
                if (entry.isActive()) {
                    StatusColorWrapper wrapper = createStatusColorWrapper(entry, customSettingsMap);
                    statusColorList.add(wrapper);
                }
            }
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => CLASSNAME, 'methodName' => 'getMobilizationStatusColors', 'isApiException' => false, 'statusCode' => null, 'exceptionObj' => e,'moreDetails' => 'Error fetching mobilization status colors: ' + e.getMessage(), 'apiResponse' => null});
        }
        
        return statusColorList;
    }
    
    private static StatusColorWrapper createStatusColorWrapper(Schema.PicklistEntry entry, Map<String, wfrecon__Mobilization_Status_Color__c> customSettingsMap) {
        StatusColorWrapper wrapper = new StatusColorWrapper();
        wrapper.picklistValue = entry.getLabel();
        wrapper.apiValue = entry.getValue();
        
        // Check if custom setting exists for this picklist value
        // Try both the label and API value as keys
        wfrecon__Mobilization_Status_Color__c customSetting = null;
        if (customSettingsMap.containsKey(entry.getLabel())) {
            customSetting = customSettingsMap.get(entry.getLabel());
        } else if (customSettingsMap.containsKey(entry.getValue())) {
            customSetting = customSettingsMap.get(entry.getValue());
        }
        
        if (customSetting != null) {
            wrapper.id = customSetting.Id;
            wrapper.textColor = customSetting.wfrecon__Color__c != null ? customSetting.wfrecon__Color__c : '#000000';
            wrapper.backgroundColor = customSetting.wfrecon__Background_Color__c != null ? customSetting.wfrecon__Background_Color__c : '#c4c4c4';
            wrapper.hasCustomSetting = true;
        } else {
            // Default colors if no custom setting exists
            wrapper.id = null;
            wrapper.textColor = '#000000';
            wrapper.backgroundColor = '#c4c4c4';
            wrapper.hasCustomSetting = false;
        }
        
        return wrapper;
    }
    
    
    @AuraEnabled
    public static Map<String, Object> saveStatusColors(List<wfrecon__Mobilization_Status_Color__c> recordsToSave) {
        Map<String, Object> response = new Map<String, Object>{
            'status' => 'ERROR',
            'message' => 'Unable to save status colors.'
        };

        try {
            if (recordsToSave == null || recordsToSave.isEmpty()) {
                response.put('message', 'No records provided to save.');
                return response;
            }

            System.debug('Records received for upsert: ' + JSON.serializePretty(recordsToSave));

            // Perform upsert using Name as key (required for Custom Setting)
            upsert recordsToSave wfrecon__Mobilization_Status_Color__c.Name;

            response.put('status', 'SUCCESS');
            response.put('message', 'Status colors saved successfully.');
            response.put('recordsProcessed', recordsToSave.size());
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => CLASSNAME, 'methodName' => 'saveStatusColors', 'isApiException' => false, 'statusCode' => null, 'exceptionObj' => e,'moreDetails' => 'Error saving mobilization status colors: ' + e.getMessage(), 'apiResponse' => null});
            response.put('message', 'Error saving status colors, Please Contact System Administrator.');
        }

        return response;
    }

    
    public class StatusColorWrapper {
        @AuraEnabled public String id;
        @AuraEnabled public String picklistValue;
        @AuraEnabled public String apiValue;
        @AuraEnabled public String textColor;
        @AuraEnabled public String backgroundColor;
        @AuraEnabled public Boolean hasCustomSetting;
        @AuraEnabled public Boolean isModified;
        
        public StatusColorWrapper() {
            this.isModified = false;
        }
    }

    public class CrewMemberDTO {
        @AuraEnabled public Id memberId;
        @AuraEnabled public Id crewId;
        @AuraEnabled public String crewName;
        @AuraEnabled public String colorCode;
        @AuraEnabled public String memberType;
    }

    public class CrewContactDTO implements Comparable {
        @AuraEnabled public Id id;
        @AuraEnabled public String name;
        @AuraEnabled public Boolean isAssignedElsewhere;
        @AuraEnabled public Boolean isAssignedToCurrentCrew;
        @AuraEnabled public String assignedCrewNames;
        @AuraEnabled public String primaryCrewColor;
        @AuraEnabled public Id currentCrewMemberId;
        @AuraEnabled public Boolean isCurrentCrewLeader;
        @AuraEnabled public String currentCrewMemberType;
        @AuraEnabled public List<CrewMemberDTO> members = new List<CrewMemberDTO>();

        public Integer compareTo(Object obj) {
            CrewContactDTO other = (CrewContactDTO)obj;
            Boolean thisAssignedElsewhere = this.isAssignedElsewhere == null ? false : this.isAssignedElsewhere;
            Boolean otherAssignedElsewhere = other.isAssignedElsewhere == null ? false : other.isAssignedElsewhere;

            if (thisAssignedElsewhere != otherAssignedElsewhere) {
                return thisAssignedElsewhere ? 1 : -1;
            }

            String thisName = this.name == null ? '' : this.name.toLowerCase();
            String otherName = other.name == null ? '' : other.name.toLowerCase();
            return thisName.compareTo(otherName);
        }
    }

    private class MobilizationTimeWindow {
        public Id mobilizationId;
        public String name;
        public Datetime startDateTime;
        public Datetime endDateTime;
    }

    private class MobilizationAssignmentInfo {
        public Id contactId;
        public String contactName;
        public Id mobilizationId;
        public String mobilizationName;
        public Datetime startDateTime;
        public Datetime endDateTime;
        public Id crewId;
        public String crewName;
    }

    public class MobilizationOverlapConflictDTO {
        @AuraEnabled public Id contactId;
        @AuraEnabled public String contactName;
        @AuraEnabled public Id targetMobilizationId;
        @AuraEnabled public String targetMobilizationName;
        @AuraEnabled public Datetime targetStart;
        @AuraEnabled public Datetime targetEnd;
        @AuraEnabled public Id conflictingMobilizationId;
        @AuraEnabled public String conflictingMobilizationName;
        @AuraEnabled public Datetime conflictingStart;
        @AuraEnabled public Datetime conflictingEnd;
        @AuraEnabled public String conflictingCrewName;
    }

    @AuraEnabled
    public static Map<String, Object> getLogEntryApprovers() {
        Map<String, Object> response = new Map<String, Object>{
            'status' => 'SUCCESS',
            'message' => '',
            'approversList' => new List<String>(),
            'timesheetApprovalFeature' => false,
            'allActiveUsers' => new List<Map<String, String>>()
        };

        try {
            // 1. Fetch Custom Setting (Org Defaults)
            wfrecon__Shift_End_Log_Configuration__c config = wfrecon__Shift_End_Log_Configuration__c.getOrgDefaults();
            
            if (config != null && config.Id != null) {
                response.put('timesheetApprovalFeature', config.wfrecon__Timesheet_Entries_Approval_Feature__c);
                
                String jsonString = config.wfrecon__Approvers_JSON__c;
                if (String.isNotBlank(jsonString)) {
                    try {
                        // We store IDs as a JSON array ["005...", "005..."] to match the field name 'JSON'
                        List<Object> rawList = (List<Object>) JSON.deserializeUntyped(jsonString);
                        List<String> idList = new List<String>();
                        for(Object obj : rawList) {
                            idList.add((String)obj);
                        }
                        response.put('approversList', idList);
                    } catch (Exception e) {
                        System.debug('Error parsing stored JSON: ' + e.getMessage());
                    }
                }
            }

            // Get all active users
            List<User> activeUsers = [
                SELECT Id, Name 
                FROM User 
                WHERE IsActive = true 
                AND Profile.Name != 'System Administrator'
                WITH USER_MODE
                ORDER BY Name ASC
            ];

            List<Map<String, String>> userList = new List<Map<String, String>>();
            for (User u : activeUsers) {
                Map<String, String> userMap = new Map<String, String>();
                userMap.put('label', u.Name);
                userMap.put('value', u.Id);
                userList.add(userMap);
            }

            response.put('allActiveUsers', userList);
        } catch (Exception e) {
            response.put('status', 'ERROR');
            response.put('message', 'Error fetching configuration: ' + e.getMessage());
            ExceptionHandler.logException(new Map<String, Object>{
                'className' => CLASSNAME, 
                'methodName' => 'getLogEntryApprovers', 
                'isApiException' => false, 
                'statusCode' => null, 
                'exceptionObj' => e,
                'moreDetails' => 'Error fetching log entry approvers: ' + e.getMessage(), 
                'apiResponse' => null
            });
        }

        return response;
    }

    @AuraEnabled
    public static Map<String, Object> saveLogEntryApprovers(List<String> approverIds, Boolean timesheetApprovalFeature) {
        Map<String, Object> response = new Map<String, Object>{
            'status' => 'ERROR',
            'message' => 'Unable to save settings.'
        };

        try {
            // 1. Validation: Max 10 Users
            if (approverIds != null && approverIds.size() > 10) {
                response.put('message', 'You cannot select more than 10 approvers.');
                return response;
            }

            // 2. Get or Create Org Defaults
            wfrecon__Shift_End_Log_Configuration__c config = wfrecon__Shift_End_Log_Configuration__c.getOrgDefaults();
            if (config == null) {
                config = new wfrecon__Shift_End_Log_Configuration__c();
            }

            // 3. Update Fields (Using same field names as Metadata)
            config.wfrecon__Timesheet_Entries_Approval_Feature__c = timesheetApprovalFeature;

            // Serialize List<Id> to JSON String to store in 'Approvers_JSON__c'
            if (approverIds != null && !approverIds.isEmpty()) {
                config.wfrecon__Approvers_JSON__c = JSON.serialize(approverIds);
            } else {
                config.wfrecon__Approvers_JSON__c = '[]';
            }

            // 4. Save
            upsert as user config;

            response.put('status', 'SUCCESS');
            response.put('message', 'Configuration saved successfully.');
            
        } catch (Exception e) {
            response.put('message', 'Error saving approvers: ' + e.getMessage());
            ExceptionHandler.logException(new Map<String, Object>{
                'className' => CLASSNAME, 
                'methodName' => 'saveLogEntryApprovers', 
                'isApiException' => false, 
                'statusCode' => null, 
                'exceptionObj' => e,
                'moreDetails' => 'Error saving log entry approvers: ' + e.getMessage(), 
                'apiResponse' => null
            });
        }

        return response;
    }

    @AuraEnabled
    public static Boolean checkEmailUniqueness(String email, String excludeContactId) {
        if (String.isBlank(email)) {
            return true; // Let standard validation handle empty fields if required
        }
        
        String query = 'SELECT Id FROM Contact WHERE Email = :email';
        
        // If we are editing, we must exclude the current record from the duplicate check
        if (String.isNotBlank(excludeContactId)) {
            query += ' AND Id != :excludeContactId';
        }
        
        query += ' LIMIT 1';
        
        List<Contact> duplicates = Database.query(query);
        return duplicates.isEmpty();
    }
}