const recommendationService = require("../services/recommendationService");

const getRecommendations = async (req, res) => {
    try {
        const userId = Number(req.params.userId);

        if (!Number.isInteger(userId) || userId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid user ID"
            });
        }

        const recommendations =
            await recommendationService.getRecommendations(userId);

        return res.status(200).json({
            success: true,
            count: recommendations.length,
            recommendations
        });
    } catch (error) {
        console.error("Recommendation error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Failed to generate recommendations"
        });
    }
};

module.exports = {
    getRecommendations
};