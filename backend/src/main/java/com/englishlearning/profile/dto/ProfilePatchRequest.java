package com.englishlearning.profile.dto;

import com.fasterxml.jackson.annotation.JsonSetter;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;

public class ProfilePatchRequest {

    @Pattern(regexp = "A1|A2|B1|B2|C1|C2", message = "englishLevel must be A1, A2, B1, B2, C1, or C2")
    private String englishLevel;

    @Min(value = 5, message = "dailyGoalMinutes must be between 5 and 240")
    @Max(value = 240, message = "dailyGoalMinutes must be between 5 and 240")
    private Integer dailyGoalMinutes;

    private String avatarUrl;
    private boolean englishLevelProvided;
    private boolean dailyGoalMinutesProvided;
    private boolean avatarUrlProvided;

    @JsonSetter("englishLevel")
    public void setEnglishLevel(String englishLevel) {
        this.englishLevelProvided = true;
        this.englishLevel = englishLevel;
    }

    @JsonSetter("dailyGoalMinutes")
    public void setDailyGoalMinutes(Integer dailyGoalMinutes) {
        this.dailyGoalMinutesProvided = true;
        this.dailyGoalMinutes = dailyGoalMinutes;
    }

    @JsonSetter("avatarUrl")
    public void setAvatarUrl(String avatarUrl) {
        this.avatarUrlProvided = true;
        this.avatarUrl = avatarUrl;
    }

    public String getEnglishLevel() { return englishLevel; }
    public Integer getDailyGoalMinutes() { return dailyGoalMinutes; }
    public String getAvatarUrl() { return avatarUrl; }
    public boolean isEnglishLevelProvided() { return englishLevelProvided; }
    public boolean isDailyGoalMinutesProvided() { return dailyGoalMinutesProvided; }
    public boolean isAvatarUrlProvided() { return avatarUrlProvided; }

    public boolean hasChanges() {
        return englishLevelProvided || dailyGoalMinutesProvided || avatarUrlProvided;
    }
}
