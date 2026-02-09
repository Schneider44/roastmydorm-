const express = require('express');
const router = express.Router();
const Question = require('../models/Question');
const Dorm = require('../models/Dorm');
const { auth } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const seo = require('../utils/seo');

/**
 * GET /api/questions/dorm/:dormId
 * Get all questions for a specific dorm
 */
router.get('/dorm/:dormId', async (req, res) => {
  try {
    const { dormId } = req.params;
    const {
      page = 1,
      limit = 10,
      category,
      sortBy = 'voteScore',
      sortOrder = 'desc',
      status = 'open,answered'
    } = req.query;

    const filter = {
      dorm: dormId,
      status: { $in: status.split(',') }
    };

    if (category && category !== 'all') {
      filter.category = category;
    }

    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const questions = await Question.find(filter)
      .populate('author', 'firstName lastName profilePicture isVerified')
      .populate('answers.author', 'firstName lastName profilePicture isVerified')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await Question.countDocuments(filter);

    res.json({
      success: true,
      data: questions,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        total,
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error fetching questions:', error);
    res.status(500).json({ success: false, message: 'Error fetching questions' });
  }
});

/**
 * GET /api/questions/:questionId
 * Get a single question with full details
 */
router.get('/:questionId', async (req, res) => {
  try {
    const { questionId } = req.params;

    const question = await Question.findByIdAndUpdate(
      questionId,
      { $inc: { views: 1 } },
      { new: true }
    )
    .populate('author', 'firstName lastName profilePicture isVerified university')
    .populate('answers.author', 'firstName lastName profilePicture isVerified')
    .populate('dorm', 'name slug location.address.city')
    .lean();

    if (!question) {
      return res.status(404).json({ success: false, message: 'Question not found' });
    }

    // Sort answers by vote score (accepted answers first)
    question.answers.sort((a, b) => {
      if (a.isAccepted && !b.isAccepted) return -1;
      if (!a.isAccepted && b.isAccepted) return 1;
      return b.voteScore - a.voteScore;
    });

    res.json({ success: true, data: question });
  } catch (error) {
    console.error('Error fetching question:', error);
    res.status(500).json({ success: false, message: 'Error fetching question' });
  }
});

/**
 * POST /api/questions
 * Create a new question
 */
router.post('/',
  auth,
  [
    body('title').trim().notEmpty().withMessage('Title is required').isLength({ max: 200 }),
    body('content').trim().notEmpty().withMessage('Content is required').isLength({ max: 2000 }),
    body('dormId').notEmpty().withMessage('Dorm ID is required'),
    body('category').optional().isIn([
      'amenities', 'pricing', 'location', 'safety', 'landlord',
      'roommates', 'utilities', 'rules', 'move-in', 'general'
    ])
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const { title, content, dormId, category = 'general', tags } = req.body;

      // Verify dorm exists
      const dorm = await Dorm.findById(dormId);
      if (!dorm) {
        return res.status(404).json({ success: false, message: 'Dorm not found' });
      }

      const question = new Question({
        title,
        content,
        dorm: dormId,
        author: req.user._id,
        category,
        tags
      });

      await question.save();

      // Populate author info before returning
      await question.populate('author', 'firstName lastName profilePicture');

      res.status(201).json({
        success: true,
        data: question,
        message: 'Question posted successfully'
      });
    } catch (error) {
      console.error('Error creating question:', error);
      res.status(500).json({ success: false, message: 'Error creating question' });
    }
  }
);

/**
 * POST /api/questions/:questionId/answers
 * Add an answer to a question
 */
router.post('/:questionId/answers',
  auth,
  [
    body('content').trim().notEmpty().withMessage('Answer content is required').isLength({ max: 2000 })
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const { questionId } = req.params;
      const { content } = req.body;

      const question = await Question.findById(questionId);
      if (!question) {
        return res.status(404).json({ success: false, message: 'Question not found' });
      }

      // Check if user is verified resident of the dorm
      const isVerifiedResident = req.user.isVerified;

      question.answers.push({
        content,
        author: req.user._id,
        isVerifiedResident
      });

      await question.updateAnswersCount();

      // Populate the new answer's author
      await question.populate('answers.author', 'firstName lastName profilePicture isVerified');

      const newAnswer = question.answers[question.answers.length - 1];

      res.status(201).json({
        success: true,
        data: newAnswer,
        message: 'Answer posted successfully'
      });
    } catch (error) {
      console.error('Error posting answer:', error);
      res.status(500).json({ success: false, message: 'Error posting answer' });
    }
  }
);

/**
 * POST /api/questions/:questionId/vote
 * Vote on a question
 */
router.post('/:questionId/vote', auth, async (req, res) => {
  try {
    const { questionId } = req.params;
    const { isUpvote } = req.body;

    const question = await Question.findById(questionId);
    if (!question) {
      return res.status(404).json({ success: false, message: 'Question not found' });
    }

    await question.vote(req.user._id, isUpvote);

    res.json({
      success: true,
      data: {
        voteScore: question.voteScore,
        upvotes: question.upvotes.length,
        downvotes: question.downvotes.length
      }
    });
  } catch (error) {
    console.error('Error voting on question:', error);
    res.status(500).json({ success: false, message: 'Error voting' });
  }
});

/**
 * POST /api/questions/:questionId/answers/:answerId/vote
 * Vote on an answer
 */
router.post('/:questionId/answers/:answerId/vote', auth, async (req, res) => {
  try {
    const { questionId, answerId } = req.params;
    const { isUpvote } = req.body;
    const userId = req.user._id.toString();

    const question = await Question.findById(questionId);
    if (!question) {
      return res.status(404).json({ success: false, message: 'Question not found' });
    }

    const answer = question.answers.id(answerId);
    if (!answer) {
      return res.status(404).json({ success: false, message: 'Answer not found' });
    }

    // Remove existing vote
    answer.upvotes = answer.upvotes.filter(id => id.toString() !== userId);
    answer.downvotes = answer.downvotes.filter(id => id.toString() !== userId);

    // Add new vote
    if (isUpvote) {
      answer.upvotes.push(req.user._id);
    } else {
      answer.downvotes.push(req.user._id);
    }

    answer.voteScore = answer.upvotes.length - answer.downvotes.length;

    await question.save();

    res.json({
      success: true,
      data: {
        voteScore: answer.voteScore,
        upvotes: answer.upvotes.length,
        downvotes: answer.downvotes.length
      }
    });
  } catch (error) {
    console.error('Error voting on answer:', error);
    res.status(500).json({ success: false, message: 'Error voting' });
  }
});

/**
 * POST /api/questions/:questionId/answers/:answerId/accept
 * Accept an answer (only question author can do this)
 */
router.post('/:questionId/answers/:answerId/accept', auth, async (req, res) => {
  try {
    const { questionId, answerId } = req.params;

    const question = await Question.findById(questionId);
    if (!question) {
      return res.status(404).json({ success: false, message: 'Question not found' });
    }

    // Only question author can accept
    if (question.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Only question author can accept answers' });
    }

    // Unmark any previously accepted answer
    question.answers.forEach(a => { a.isAccepted = false; });

    // Accept the answer
    const answer = question.answers.id(answerId);
    if (!answer) {
      return res.status(404).json({ success: false, message: 'Answer not found' });
    }

    answer.isAccepted = true;
    question.isResolved = true;
    question.status = 'answered';

    await question.save();

    res.json({
      success: true,
      message: 'Answer accepted successfully'
    });
  } catch (error) {
    console.error('Error accepting answer:', error);
    res.status(500).json({ success: false, message: 'Error accepting answer' });
  }
});

/**
 * POST /api/questions/:questionId/report
 * Report a question
 */
router.post('/:questionId/report', auth, async (req, res) => {
  try {
    const { questionId } = req.params;
    const { reason, description } = req.body;

    const question = await Question.findById(questionId);
    if (!question) {
      return res.status(404).json({ success: false, message: 'Question not found' });
    }

    // Check if already reported by this user
    const alreadyReported = question.reports.some(
      r => r.reportedBy.toString() === req.user._id.toString()
    );

    if (alreadyReported) {
      return res.status(400).json({ success: false, message: 'You have already reported this question' });
    }

    question.reports.push({
      reportedBy: req.user._id,
      reason,
      description
    });

    await question.save();

    res.json({
      success: true,
      message: 'Question reported successfully'
    });
  } catch (error) {
    console.error('Error reporting question:', error);
    res.status(500).json({ success: false, message: 'Error reporting question' });
  }
});

/**
 * GET /api/questions/dorm/:dormId/faq-schema
 * Get FAQ schema for SEO
 */
router.get('/dorm/:dormId/faq-schema', async (req, res) => {
  try {
    const { dormId } = req.params;

    const questions = await Question.find({
      dorm: dormId,
      status: { $in: ['open', 'answered'] },
      'answers.0': { $exists: true }
    })
    .select('title answers.content answers.isAccepted answers.voteScore')
    .sort({ voteScore: -1 })
    .limit(10)
    .lean();

    // Only include questions with answers
    const faqQuestions = questions.map(q => ({
      title: q.title,
      answers: q.answers.filter(a => a.status !== 'removed')
        .sort((a, b) => {
          if (a.isAccepted && !b.isAccepted) return -1;
          return b.voteScore - a.voteScore;
        })
    }));

    const faqSchema = seo.generateFAQSchema(faqQuestions);

    res.json({ success: true, data: faqSchema });
  } catch (error) {
    console.error('Error generating FAQ schema:', error);
    res.status(500).json({ success: false, message: 'Error generating FAQ schema' });
  }
});

module.exports = router;
