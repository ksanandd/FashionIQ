
const db = require("../config/db");

// Get logged-in user's profile
const getUserProfile = async (req, res) => {
    try {
        const userId = req.user.user_id;

        const [rows] = await db.execute(
            `SELECT
                u.user_id,
                u.first_name,
                u.last_name,
                u.email,
                u.role,
                u.street,
                u.city,
                u.state,
                u.pincode,
                up.profile_id,
                up.height,
                up.weight,
                up.body_type,
                up.style_preferences,
                up.budget_range_min,
                up.budget_range_max,
                up.preferred_brands
            FROM \`USER\` u
            LEFT JOIN USER_PROFILE up
                ON u.user_id = up.user_id
            WHERE u.user_id = ?`,
            [userId]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        return res.status(200).json({
            success: true,
            message: "User profile retrieved successfully",
            profile: rows[0]
        });

    } catch (error) {
        console.error("Get user profile error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};

// Create or update fashion profile
const updateFashionProfile = async (req, res) => {
    try {
        const userId = req.user.user_id;

        const {
            height,
            weight,
            body_type,
            style_preferences,
            budget_range_min,
            budget_range_max,
            preferred_brands
        } = req.body;

        if (
            budget_range_min != null &&
            budget_range_max != null &&
            Number(budget_range_min) > Number(budget_range_max)
        ) {
            return res.status(400).json({
                success: false,
                message: "Minimum budget cannot exceed maximum budget"
            });
        }

        const [existingProfile] = await db.execute(
            "SELECT profile_id FROM USER_PROFILE WHERE user_id = ?",
            [userId]
        );

        if (existingProfile.length > 0) {
            await db.execute(
                `UPDATE USER_PROFILE
                 SET height = ?,
                     weight = ?,
                     body_type = ?,
                     style_preferences = ?,
                     budget_range_min = ?,
                     budget_range_max = ?,
                     preferred_brands = ?
                 WHERE user_id = ?`,
                [
                    height ?? null,
                    weight ?? null,
                    body_type ?? null,
                    style_preferences ?? null,
                    budget_range_min ?? null,
                    budget_range_max ?? null,
                    preferred_brands ?? null,
                    userId
                ]
            );
        } else {
            await db.execute(
                `INSERT INTO USER_PROFILE
                 (user_id, height, weight, body_type,
                  style_preferences, budget_range_min,
                  budget_range_max, preferred_brands)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    userId,
                    height ?? null,
                    weight ?? null,
                    body_type ?? null,
                    style_preferences ?? null,
                    budget_range_min ?? null,
                    budget_range_max ?? null,
                    preferred_brands ?? null
                ]
            );
        }

        return res.status(200).json({
            success: true,
            message: "Fashion profile saved successfully"
        });

    } catch (error) {
        console.error("Update fashion profile error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};


// Update user's address
const updateUserAddress = async (req, res) => {
    try {
        const userId = req.user.user_id;

        const { street, city, state, pincode } = req.body;

        if (!street || !city || !state || !pincode) {
            return res.status(400).json({
                success: false,
                message: "All address fields are required"
            });
        }

        await db.execute(
            `UPDATE \`USER\`
             SET street = ?,
                 city = ?,
                 state = ?,
                 pincode = ?
             WHERE user_id = ?`,
            [street, city, state, pincode, userId]
        );

        return res.status(200).json({
            success: true,
            message: "Address updated successfully"
        });

    } catch (error) {
        console.error("Update address error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};

module.exports = {
    getUserProfile,
    updateFashionProfile,
    updateUserAddress
};
