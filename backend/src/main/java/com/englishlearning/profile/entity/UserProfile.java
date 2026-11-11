package com.englishlearning.profile.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.MapsId;
import jakarta.persistence.OneToOne;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;

@Entity
@Table(name = "user_profiles")
public class UserProfile {

    @Id
    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @MapsId
    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "english_level", nullable = false, length = 8)
    private String englishLevel;

    @Column(name = "daily_goal_minutes", nullable = false)
    private short dailyGoalMinutes;

    @Column(name = "avatar_url", columnDefinition = "text")
    private String avatarUrl;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    protected UserProfile() {
    }

    public static UserProfile create(User user, String englishLevel, int dailyGoalMinutes, String avatarUrl) {
        UserProfile profile = new UserProfile();
        profile.user = user;
        profile.englishLevel = englishLevel;
        profile.dailyGoalMinutes = (short) dailyGoalMinutes;
        profile.avatarUrl = avatarUrl;
        profile.updatedAt = OffsetDateTime.now(ZoneOffset.UTC);
        return profile;
    }

    public void update(String englishLevel, Integer dailyGoalMinutes, String avatarUrl, boolean updateAvatar) {
        if (englishLevel != null) {
            this.englishLevel = englishLevel;
        }
        if (dailyGoalMinutes != null) {
            this.dailyGoalMinutes = dailyGoalMinutes.shortValue();
        }
        if (updateAvatar) {
            this.avatarUrl = avatarUrl;
        }
        this.updatedAt = OffsetDateTime.now(ZoneOffset.UTC);
    }

    @PreUpdate
    void updateTimestamp() {
        this.updatedAt = OffsetDateTime.now(ZoneOffset.UTC);
    }

    public UUID getUserId() {
        // With @MapsId, Hibernate assigns the ID from the associated User during persist.
        return userId != null ? userId : user.getId();
    }

    public String getEnglishLevel() {
        return englishLevel;
    }

    public short getDailyGoalMinutes() {
        return dailyGoalMinutes;
    }

    public String getAvatarUrl() {
        return avatarUrl;
    }

    public OffsetDateTime getUpdatedAt() {
        return updatedAt;
    }
}
